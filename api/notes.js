import jwt from "jsonwebtoken";
import { getGraphClient, getSiteId, getJwtSecret, fetchAllListItems } from "./lib/graph-client.js";
import { LIST_IDS } from "./lib/constants.js";

const getBearerToken = (req) => {
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  return authorization.split(" ")[1];
};

const getWeekNumber = (date) => {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
};

const toDateText = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const toMonthYear = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${month}/${date.getFullYear()}`;
};

const toTimeText = (date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export default async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
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
      const allNotas = await fetchAllListItems(client, siteId, LIST_IDS.notasExpress);
      const notas = allNotas
        .filter((item) => {
          const status = String(item.Status_NE || item.Status_x0020_NE || "").trim().toLowerCase();
          return status === "activo";
        })
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      return res.status(200).json({ success: true, notes: notas });
    }

    if (req.method === "POST") {
      const detail = String(req.body?.detail || "").trim();
      if (!detail) {
        return res.status(400).json({ error: "La nota no puede estar vacia" });
      }

      const now = new Date();
      const userLabel = authPayload?.Title || authPayload?.username || "Usuario";

      const createResponse = await client
        .api(`/sites/${siteId}/lists/${LIST_IDS.notasExpress}/items`)
        .post({
          fields: {
            Title: "boutique",
            Usuario_NE: userLabel,
            Fecha_NE: toDateText(now),
            FechaMesAno_NE: toMonthYear(now),
            FechaAno_NE: String(now.getFullYear()),
            Hora_NE: toTimeText(now),
            Semana_NE: `${now.getFullYear()}${String(getWeekNumber(now)).padStart(2, "0")}`,
            Detalle_NE: detail,
            Status_NE: "Activo",
          },
        });

      return res.status(200).json({ success: true, id: createResponse.id });
    }

    const noteId = String(req.query?.id || req.body?.id || "").trim();
    if (!noteId) {
      return res.status(400).json({ error: "Falta el ID de la nota" });
    }

    await client
      .api(`/sites/${siteId}/lists/${LIST_IDS.notasExpress}/items/${noteId}/fields`)
      .patch({
        Status_NE: "Eliminado",
      });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Notes API Error:", error?.message || error);
    return res.status(500).json({ error: "Error interno al procesar notas" });
  }
}
