import jwt from "jsonwebtoken";
import { getGraphClient, getSiteId, getJwtSecret, fetchAllListItems } from "./lib/graph-client.js";
import { LIST_IDS } from "./lib/constants.js";

const DAY_NAMES_ES = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

const STATUS_ALIASES = {
  pending: "Pendiente",
  pendiente: "Pendiente",
  finished: "Terminado",
  terminado: "Terminado",
  delivered: "Entregado",
  entregado: "Entregado",
  retirado: "Entregado",
  deleted: "Eliminado",
  eliminado: "Eliminado",
};

const getBearerToken = (req) => {
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  return authorization.split(" ")[1];
};

const pad2 = (value) => String(value).padStart(2, "0");

const toDateText = (date) => `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;

const toMonthYearText = (date) => `${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;

const toTimeText = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const toDayName = (date) => DAY_NAMES_ES[date.getDay()] || "";

const normalizeStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return STATUS_ALIASES[normalized] || String(value || "").trim() || "Pendiente";
};

const parseDateFromUi = (value) => {
  if (!value || typeof value !== "string") return null;

  const yyyyMmDd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDd) {
    const date = new Date(Number(yyyyMmDd[1]), Number(yyyyMmDd[2]) - 1, Number(yyyyMmDd[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const ddMmYyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddMmYyyy) {
    const date = new Date(Number(ddMmYyyy[3]), Number(ddMmYyyy[2]) - 1, Number(ddMmYyyy[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const parseTurnoDate = (item) => {
  const dateCandidates = [
    item.FechaDateValue_T,
    item.FechaDateValue,
    item.FechaDateISO_T,
    item.FechaDateISO,
  ].filter(Boolean);

  for (const candidate of dateCandidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dateText = String(item.Fecha_T || item.Fecha_x0020_T || "").trim();
  const parsedText = parseDateFromUi(dateText);
  return parsedText;
};

const parseTimeToMinutes = (timeValue) => {
  const raw = String(timeValue || "").trim();
  if (!raw) return Number.MAX_SAFE_INTEGER;

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return Number.MAX_SAFE_INTEGER;

  return hh * 60 + mm;
};

const parseMultiQueryParam = (rawValue) => {
  const normalized = String(rawValue || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return [];

  return normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const getCurrentWindowMonthYears = () => {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return new Set([toMonthYearText(prev), toMonthYearText(now), toMonthYearText(next)]);
};

const getWeekNumber = (date) => {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
};

const normalizeBooleanFlag = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "NO";
  if (["si", "s", "yes", "true", "1"].includes(normalized)) return "SI";
  return "NO";
};

const mapTurnoForClient = (item) => {
  const date = parseTurnoDate(item);
  return {
    id: String(item.id),
    status: normalizeStatus(item.Status_T || item.Status_x0020_T || "Pendiente"),
    dateText: String(item.Fecha_T || item.Fecha_x0020_T || ""),
    dateIso: date ? `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` : "",
    dayName: String(item.Dia_T || item.Dia_x0020_T || ""),
    monthYear: String(item.FechaMesAno_T || item.Fecha_x0020_Mes_x0020_A_x00f1_o_T || ""),
    year: String(item.FechaAno_T || item.Fecha_x0020_A_x00f1_o_T || ""),
    weekNumber: String(item.WeekNum_T || ""),
    weekConcat: String(item.ConcatWeekNum_T || ""),
    weekday: Number(item.WeekDay_T || item.WeekDay_x0020_T || 0) || 0,
    time: String(item.Hora_T || item.Hora_x0020_T || ""),
    timeEnd: String(item.HoraSalida_T || item.HoraSalida_x0020_T || ""),
    insurance: String(item.Seguro_T || item.Seguro_x0020_T || ""),
    car: String(item.Auto_T || item.Auto_x0020_T || ""),
    licensePlate: String(item.Patente_T || item.Patente_x0020_T || ""),
    requiresPhoto: normalizeBooleanFlag(item.RequiereFoto_T || item.RequiereFoto_x0020_T),
    client: String(item.Cliente_T || item.Cliente_x0020_T || ""),
    phone: String(item.Telefono_T || item.Telefono_x0020_T || ""),
    polarized: normalizeBooleanFlag(item.Polarizado_T || item.Polarizado_x0020_T),
    engraving: normalizeBooleanFlag(item.Grabado_T || item.Grabado_x0020_T),
    description: String(item.Descripcion_T || item.Descripcion_x0020_T || ""),
    user: String(item.Usuario_T || item.Usuario_x0020_T || ""),
    whatsapp: normalizeBooleanFlag(item.Whatsapp_T || item.Whatsapp_x0020_T),
    streetJob: normalizeBooleanFlag(item.Calle_T || item.Calle_x0020_T),
    uniqueCode: String(item.IDUnivoco_T || item.IDUnivoco_x0020_T || ""),
    finishedDate: String(item.FechaTerminado_T || ""),
    finishedTime: String(item.HoraTerminado_T || ""),
    deliveredDate: String(item.FechaEntregado_T || ""),
    deliveredTime: String(item.HoraEntregado_T || ""),
  };
};

const buildTurnoFields = ({ appointment, currentUserName }) => {
  const now = new Date();
  const appointmentDate = parseDateFromUi(appointment.date);

  if (!appointmentDate) {
    throw new Error("La fecha del turno es invalida");
  }

  const startTime = String(appointment.time || "").trim();
  if (!startTime) {
    throw new Error("La hora de entrada es obligatoria");
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfSelected = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
  if (startOfSelected < startOfToday) {
    throw new Error("La fecha del turno no puede ser menor a hoy");
  }

  const phoneSanitized = String(appointment.phone || "").replace(/-/g, "").trim();
  const status = normalizeStatus(appointment.status || "Pendiente");

  return {
    Title: "boutique",
    Status_T: status,
    Dia_T: toDayName(appointmentDate),
    IDUnivoco_T: `Turno - ${currentUserName || "Usuario"} - ${toDateText(now).replace(/\//g, "")}${toTimeText(now).replace(":", "")}${String(now.getSeconds()).padStart(2, "0")}`,
    Fecha_T: toDateText(appointmentDate),
    FechaAno_T: String(appointmentDate.getFullYear()),
    FechaMesAno_T: toMonthYearText(appointmentDate),
    WeekNum_T: String(getWeekNumber(appointmentDate)),
    ConcatWeekNum_T: `${appointmentDate.getFullYear()}${String(getWeekNumber(appointmentDate)).padStart(2, "0")}`,
    Patente_T: String(appointment.licensePlate || "").toUpperCase().trim(),
    Hora_T: startTime,
    Seguro_T: String(appointment.insurance || "").trim(),
    Auto_T: String(appointment.car || "").trim(),
    Cliente_T: String(appointment.client || "").trim(),
    Telefono_T: String(appointment.phone || "").trim(),
    Usuario_T: currentUserName || "",
    Descripcion_T: String(appointment.description || "").trim(),
    RequiereFoto_T: normalizeBooleanFlag(appointment.requiresPhoto),
    Polarizado_T: normalizeBooleanFlag(appointment.polarized),
    Grabado_T: normalizeBooleanFlag(appointment.engraving),
    Whatsapp_T: phoneSanitized ? normalizeBooleanFlag(appointment.whatsapp || "SI") : "NO",
    WeekDay_T: String(appointmentDate.getDay() + 1),
    HoraSalida_T: String(appointment.timeEnd || "").trim(),
    Calle_T: String(appointment.insurance || "").trim().toUpperCase() === "TALLER" ? "SI" : "NO",
  };
};

async function fetchTurnoById(client, siteId, id) {
  const response = await client
    .api(`/sites/${siteId}/lists/${LIST_IDS.turnos}/items/${id}?$expand=fields`)
    .get();

  return { ...(response.fields || {}), id: response.id };
}

export default async function handler(req, res) {
  if (!["GET", "POST", "PUT", "PATCH"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let authPayload;
  try {
    authPayload = jwt.verify(token, getJwtSecret());
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const siteId = getSiteId();
    const client = await getGraphClient();

    if (req.method === "GET") {
      const requestedId = String(req.query?.id || "").trim();
      if (requestedId) {
        const item = await fetchTurnoById(client, siteId, requestedId);
        return res.status(200).json({ success: true, appointment: mapTurnoForClient(item) });
      }

      const requestedStatuses = parseMultiQueryParam(req.query?.status);
      const statusSet = new Set(requestedStatuses.map((status) => normalizeStatus(status)));

      const requestedInsurances = parseMultiQueryParam(req.query?.insurance);
      const insuranceSet = new Set(requestedInsurances.map((value) => value.toLowerCase()));

      const plateQuery = String(req.query?.plate || "").trim().toLowerCase();

      const fromDateRaw = String(req.query?.from || "").trim();
      const toDateRaw = String(req.query?.to || "").trim();
      const fromDate = fromDateRaw ? new Date(`${fromDateRaw}T00:00:00`) : null;
      const toDate = toDateRaw ? new Date(`${toDateRaw}T23:59:59`) : null;
      const validFromDate = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
      const validToDate = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;

      const shouldUseDefaultWindow = !validFromDate && !validToDate;
      const defaultMonthYears = getCurrentWindowMonthYears();
      const effectiveStatusSet = statusSet.size > 0 ? statusSet : new Set(["Pendiente", "Terminado"]);

      const allTurnos = await fetchAllListItems(client, siteId, LIST_IDS.turnos);

      const filtered = allTurnos
        .filter((item) => {
          const status = normalizeStatus(item.Status_T || item.Status_x0020_T || "");
          if (!effectiveStatusSet.has(status)) return false;

          const insurance = String(item.Seguro_T || item.Seguro_x0020_T || "").trim().toLowerCase();
          if (insuranceSet.size > 0 && !insuranceSet.has(insurance)) return false;

          const patente = String(item.Patente_T || item.Patente_x0020_T || "").trim().toLowerCase();
          if (plateQuery && !patente.includes(plateQuery)) return false;

          const appointmentDate = parseTurnoDate(item);
          if (validFromDate && (!appointmentDate || appointmentDate < validFromDate)) return false;
          if (validToDate && (!appointmentDate || appointmentDate > validToDate)) return false;

          if (shouldUseDefaultWindow) {
            const monthYear = String(item.FechaMesAno_T || item.Fecha_x0020_Mes_x0020_A_x00f1_o_T || "").trim();
            if (!defaultMonthYears.has(monthYear)) return false;
          }

          return true;
        })
        .sort((a, b) => {
          const dateA = parseTurnoDate(a);
          const dateB = parseTurnoDate(b);
          if (dateA && dateB && dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }

          if (dateA && !dateB) return -1;
          if (!dateA && dateB) return 1;

          const timeA = parseTimeToMinutes(a.Hora_T || a.Hora_x0020_T);
          const timeB = parseTimeToMinutes(b.Hora_T || b.Hora_x0020_T);
          if (timeA !== timeB) return timeA - timeB;

          return Number(a.id || 0) - Number(b.id || 0);
        })
        .map(mapTurnoForClient);

      return res.status(200).json({ success: true, appointments: filtered });
    }

    if (req.method === "POST") {
      const appointment = req.body?.appointment;
      if (!appointment || typeof appointment !== "object") {
        return res.status(400).json({ error: "Faltan datos del turno" });
      }

      const currentUserName = authPayload?.Title || authPayload?.username || "Usuario";
      const fields = buildTurnoFields({ appointment, currentUserName });

      const created = await client
        .api(`/sites/${siteId}/lists/${LIST_IDS.turnos}/items`)
        .post({ fields });

      const saved = await fetchTurnoById(client, siteId, created.id);
      return res.status(200).json({ success: true, appointment: mapTurnoForClient(saved) });
    }

    if (req.method === "PUT") {
      const appointmentId = String(req.body?.id || "").trim();
      const appointment = req.body?.appointment;

      if (!appointmentId) {
        return res.status(400).json({ error: "Falta el ID del turno" });
      }

      if (!appointment || typeof appointment !== "object") {
        return res.status(400).json({ error: "Faltan datos del turno" });
      }

      const currentUserName = authPayload?.Title || authPayload?.username || "Usuario";
      const fields = buildTurnoFields({ appointment, currentUserName });
      const currentItem = await fetchTurnoById(client, siteId, appointmentId);
      const currentStatus = normalizeStatus(currentItem.Status_T || currentItem.Status_x0020_T || "Pendiente");
      fields.Status_T = normalizeStatus(appointment.status || currentStatus);

      await client
        .api(`/sites/${siteId}/lists/${LIST_IDS.turnos}/items/${appointmentId}/fields`)
        .patch(fields);

      const saved = await fetchTurnoById(client, siteId, appointmentId);
      return res.status(200).json({ success: true, appointment: mapTurnoForClient(saved) });
    }

    const appointmentId = String(req.body?.id || "").trim();
    const action = String(req.body?.action || "").trim().toLowerCase();
    if (!appointmentId || !action) {
      return res.status(400).json({ error: "Falta el ID o la accion del turno" });
    }

    const now = new Date();
    const patchFields = {};

    if (action === "finish") {
      patchFields.Status_T = "Terminado";
      patchFields.FechaTerminado_T = toDateText(now);
      patchFields.HoraTerminado_T = toTimeText(now);
      if (req.body?.markWhatsappSent === true) {
        patchFields.Whatsapp_T = "SI";
      }
    } else if (action === "deliver") {
      patchFields.Status_T = "Retirado";
      patchFields.FechaEntregado_T = toDateText(now);
      patchFields.HoraEntregado_T = toTimeText(now);
    } else if (action === "delete") {
      patchFields.Status_T = "Eliminado";
    } else if (action === "pending") {
      patchFields.Status_T = "Pendiente";
    } else if (action === "set-status") {
      patchFields.Status_T = normalizeStatus(req.body?.status);
    } else {
      return res.status(400).json({ error: "Accion no soportada" });
    }

    await client
      .api(`/sites/${siteId}/lists/${LIST_IDS.turnos}/items/${appointmentId}/fields`)
      .patch(patchFields);

    const saved = await fetchTurnoById(client, siteId, appointmentId);
    return res.status(200).json({ success: true, appointment: mapTurnoForClient(saved) });
  } catch (error) {
    console.error("Appointments API Error:", error?.message || error);
    return res.status(500).json({ error: error?.message || "Error interno al procesar turnos" });
  }
}
