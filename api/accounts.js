import jwt from "jsonwebtoken";
import { getGraphClient, getSiteId, getJwtSecret, fetchAllListItems } from "./lib/graph-client.js";
import { LIST_IDS } from "./lib/constants.js";

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeProvider = (value) => String(value || "").trim();

const getBearerToken = (req) => {
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  return authorization.split(" ")[1];
};

const fieldValue = (item, keys, fallback = "") => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== "") return item[key];
  }
  return fallback;
};

const parseAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value || "").replace(/\./g, "").replace(/,/g, ".").trim();
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

const toDdMmYyyy = (dateLike = new Date()) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const toMmYyyy = (dateLike = new Date()) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const parseDateFlexible = (item) => {
  const direct = fieldValue(item, ["FechaDateValue_FP", "FechaDateValue"]);
  if (direct) {
    const parsed = new Date(direct);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dateText = String(fieldValue(item, ["Fecha_FP", "Fecha"])).trim();
  const match = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  return new Date(0);
};

const getProviderFromAccount = (accountItem) =>
  normalizeProvider(fieldValue(accountItem, ["Proveedor_CC", "Proveedor", "Title"]));

const getProviderFromMovement = (movement) =>
  normalizeProvider(fieldValue(movement, ["Proveedor_FP", "Proveedor", "Title"]));

const getMovementStatus = (movement) =>
  String(fieldValue(movement, ["Status_FP", "Status", "Estado"], "Pendiente")).trim();

const getMovementInvoiceNumber = (movement) =>
  String(fieldValue(movement, ["NroFactura_FP", "NroFactura", "Factura"], "")).trim();

const getMonthYearFromMovement = (movement) =>
  String(fieldValue(movement, ["FechaMesAno_FP", "FechaMesAno", "FechaMesAnio"], "")).trim();

const isMovementDeleted = (movement) => normalizeText(getMovementStatus(movement)) === "anulada";

const toComparableInvoice = (value) => {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return "";
  const digits = raw.replace(/\D/g, "");
  return digits || raw.toLowerCase();
};

const monthYearSetLastN = (n) => {
  const result = new Set();
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.add(toMmYyyy(d));
  }
  return result;
};

async function createListItem(client, siteId, listId, fields) {
  const created = await client.api(`/sites/${siteId}/lists/${listId}/items`).post({ fields });
  return { id: created.id, ...fields };
}

async function updateListItemFields(client, siteId, listId, itemId, fields) {
  await client.api(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`).patch(fields);
}

async function deleteListItem(client, siteId, listId, itemId) {
  await client.api(`/sites/${siteId}/lists/${listId}/items/${itemId}`).delete();
}

async function fetchAccounts(client, siteId) {
  return fetchAllListItems(client, siteId, LIST_IDS.cuentaCorriente);
}

async function fetchMovements(client, siteId) {
  return fetchAllListItems(client, siteId, LIST_IDS.facturaProveedores);
}

const computeLedgerForProvider = (movements, providerName) => {
  const normalizedProvider = normalizeText(providerName);
  const providerMovements = movements
    .filter((item) => normalizeText(getProviderFromMovement(item)) === normalizedProvider)
    .sort((a, b) => {
      const dateDiff = parseDateFlexible(a).getTime() - parseDateFlexible(b).getTime();
      if (dateDiff !== 0) return dateDiff;
      return Number(a.id) - Number(b.id);
    });

  let runningBalance = 0;
  let runningDebt = 0;
  let runningCredit = 0;

  const ledger = providerMovements.map((movement) => {
    const amount = parseAmount(fieldValue(movement, ["MontoTotal_FP", "Monto", "MontoTotal"], 0));
    const deleted = isMovementDeleted(movement);

    const balancePre = runningBalance;

    if (!deleted) {
      runningBalance = round2(runningBalance + amount);
      if (amount >= 0) {
        runningDebt = round2(runningDebt + amount);
      } else {
        runningCredit = round2(runningCredit + amount);
      }
    }

    const balancePost = runningBalance;

    return {
      movement,
      amount,
      deleted,
      balancePre,
      balancePost,
      runningDebt,
      runningCredit,
    };
  });

  return {
    ledger,
    summary: {
      provider: providerName,
      balance: round2(runningBalance),
      debt: round2(runningDebt),
      credit: round2(runningCredit),
    },
  };
};

async function ensureAccountRow(client, siteId, accounts, providerName) {
  const normalized = normalizeText(providerName);
  const existing = accounts.find((acc) => normalizeText(getProviderFromAccount(acc)) === normalized);
  if (existing) return existing;

  const created = await createListItem(client, siteId, LIST_IDS.cuentaCorriente, {
    Title: "boutique",
    Proveedor_CC: providerName,
    Deuda_CC: 0,
    Haber_CC: 0,
    Balance_CC: 0,
    Status_CC: "Activo",
  });

  return created;
}

async function recomputeAndPersistProvider(client, siteId, providerName) {
  const [accounts, movements] = await Promise.all([fetchAccounts(client, siteId), fetchMovements(client, siteId)]);
  const accountRow = await ensureAccountRow(client, siteId, accounts, providerName);

  const { ledger, summary } = computeLedgerForProvider(movements, providerName);

  for (const row of ledger) {
    const existingPre = round2(parseAmount(fieldValue(row.movement, ["BalancePreFactura_FP"], 0)));
    const existingPost = round2(parseAmount(fieldValue(row.movement, ["BalancePostFactura_FP"], 0)));
    if (existingPre !== row.balancePre || existingPost !== row.balancePost) {
      await updateListItemFields(client, siteId, LIST_IDS.facturaProveedores, row.movement.id, {
        BalancePreFactura_FP: row.balancePre,
        BalancePostFactura_FP: row.balancePost,
      });
    }
  }

  await updateListItemFields(client, siteId, LIST_IDS.cuentaCorriente, accountRow.id, {
    Deuda_CC: summary.debt,
    Haber_CC: summary.credit,
    Balance_CC: summary.balance,
  });

  return summary;
}

const mapMovementForUi = (ledgerRow) => {
  const { movement, amount, deleted, balancePre, balancePost, runningDebt, runningCredit } = ledgerRow;
  const status = getMovementStatus(movement);

  return {
    id: String(movement.id),
    provider: getProviderFromMovement(movement),
    date: fieldValue(movement, ["Fecha_FP"], toDdMmYyyy(parseDateFlexible(movement))),
    monthYear: getMonthYearFromMovement(movement),
    invoiceNumber: getMovementInvoiceNumber(movement),
    cancelledInvoiceNumber: String(fieldValue(movement, ["NroFacturaCancelada_FP"], "")).trim(),
    type: String(fieldValue(movement, ["Tipo_FP"], amount < 0 ? "Pago" : "Compra")).trim(),
    status,
    deleted,
    amount,
    balancePre,
    balancePost,
    debtRunning: runningDebt,
    creditRunning: runningCredit,
    description: String(fieldValue(movement, ["Observaciones_FP", "Observaciones"], "")).trim(),
    docId: String(fieldValue(movement, ["IDAux_FP"], "")).trim(),
  };
};

async function getProvidersSummary(client, siteId) {
  const [accounts, movements] = await Promise.all([fetchAccounts(client, siteId), fetchMovements(client, siteId)]);

  const activeAccounts = accounts.filter((acc) => {
    const status = normalizeText(fieldValue(acc, ["Status_CC", "Status"], "Activo"));
    return !status || status === "activo";
  });

  const map = new Map();

  for (const account of activeAccounts) {
    const provider = getProviderFromAccount(account);
    if (!provider) continue;
    map.set(normalizeText(provider), {
      id: String(account.id),
      provider,
      balance: round2(parseAmount(fieldValue(account, ["Balance_CC"], 0))),
      debt: round2(parseAmount(fieldValue(account, ["Deuda_CC"], 0))),
      credit: round2(parseAmount(fieldValue(account, ["Haber_CC"], 0))),
    });
  }

  // Include providers that already have movements but might not have an account row yet.
  const providersInMovements = Array.from(
    new Set(movements.map((m) => getProviderFromMovement(m)).filter(Boolean))
  );

  for (const provider of providersInMovements) {
    const key = normalizeText(provider);
    if (!map.has(key)) {
      const { summary } = computeLedgerForProvider(movements, provider);
      map.set(key, {
        id: key,
        provider,
        balance: summary.balance,
        debt: summary.debt,
        credit: summary.credit,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.provider.localeCompare(b.provider, "es"));
}

async function getProviderDetail(client, siteId, providerName) {
  const provider = normalizeProvider(providerName);
  if (!provider) {
    throw new Error("Proveedor inválido");
  }

  const [accounts, movements] = await Promise.all([fetchAccounts(client, siteId), fetchMovements(client, siteId)]);

  const account = accounts.find((acc) => normalizeText(getProviderFromAccount(acc)) === normalizeText(provider));
  const effectiveProvider = account ? getProviderFromAccount(account) : provider;

  const { ledger, summary } = computeLedgerForProvider(movements, effectiveProvider);

  const uiMovements = ledger
    .map(mapMovementForUi)
    .sort((a, b) => {
      const da = parseDateFlexible({ Fecha_FP: a.date, FechaDateValue_FP: null }).getTime();
      const db = parseDateFlexible({ Fecha_FP: b.date, FechaDateValue_FP: null }).getTime();
      if (db !== da) return db - da;
      return Number(b.id) - Number(a.id);
    });

  const pendingInvoices = uiMovements
    .filter((m) => normalizeText(m.status) === "pendiente" && m.amount > 0)
    .map((m) => ({ id: m.id, invoiceNumber: m.invoiceNumber, amount: m.amount, date: m.date }));

  return {
    provider: effectiveProvider,
    summary: {
      balance: round2(account ? parseAmount(fieldValue(account, ["Balance_CC"], summary.balance)) : summary.balance),
      debt: round2(account ? parseAmount(fieldValue(account, ["Deuda_CC"], summary.debt)) : summary.debt),
      credit: round2(account ? parseAmount(fieldValue(account, ["Haber_CC"], summary.credit)) : summary.credit),
    },
    movements: uiMovements,
    pendingInvoices,
  };
}

async function attachProviderDocument(client, siteId, payload) {
  const fileDataUrl = String(payload?.attachmentDataUrl || "").trim();
  const docId = String(payload?.docId || "").trim();
  if (!fileDataUrl || !docId) return;

  const docType = fileDataUrl.toLowerCase().startsWith("data:application/pdf") ? "pdf" : "jpeg";

  await createListItem(client, siteId, LIST_IDS.fotoFacturaProveedores, {
    Title: "boutique",
    FotoFactura_FP: fileDataUrl,
    IDFacturaProveedor_FP: docId,
    DocType_FP: docType,
  });
}

async function setInvoicesStatusByNumbers(client, siteId, providerName, invoiceNumbers, status) {
  if (!Array.isArray(invoiceNumbers) || invoiceNumbers.length === 0) return;

  const normalizedProvider = normalizeText(providerName);
  const targetSet = new Set(invoiceNumbers.map((inv) => toComparableInvoice(inv)).filter(Boolean));
  if (targetSet.size === 0) return;

  const movements = await fetchMovements(client, siteId);
  const matches = movements.filter((movement) => {
    if (normalizeText(getProviderFromMovement(movement)) !== normalizedProvider) return false;
    const comparable = toComparableInvoice(getMovementInvoiceNumber(movement));
    if (!comparable || !targetSet.has(comparable)) return false;
    return parseAmount(fieldValue(movement, ["MontoTotal_FP"], 0)) > 0;
  });

  for (const movement of matches) {
    await updateListItemFields(client, siteId, LIST_IDS.facturaProveedores, movement.id, {
      Status_FP: status,
    });
  }
}

async function createMovement(client, siteId, reqBody, userName) {
  const actionType = String(reqBody?.movementType || "").trim().toLowerCase();
  const provider = normalizeProvider(reqBody?.provider);
  const amountRaw = parseAmount(reqBody?.amount);
  const dateRaw = reqBody?.date;
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const dateText = toDdMmYyyy(date);
  const monthYear = toMmYyyy(date);
  const yearText = String(date.getFullYear());
  const timeText = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  if (!provider) throw new Error("Debes seleccionar un proveedor");
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) throw new Error("El monto debe ser mayor a 0");

  const isPayment = actionType === "payment";
  const isPurchase = actionType === "purchase";
  if (!isPayment && !isPurchase) throw new Error("Tipo de movimiento inválido");

  const invoiceNumber = String(reqBody?.invoiceNumber || "").trim();
  const type = String(reqBody?.type || (isPayment ? "Pago" : "Deuda")).trim();
  const observation = String(reqBody?.observation || "").trim();
  const cancelledInvoiceNumbers = Array.isArray(reqBody?.cancelledInvoiceNumbers)
    ? reqBody.cancelledInvoiceNumbers.filter(Boolean).map((n) => String(n))
    : [];

  const movements = await fetchMovements(client, siteId);

  if (invoiceNumber && invoiceNumber !== "-") {
    const targetMonths = monthYearSetLastN(2);
    const duplicated = movements.some((movement) => {
      if (normalizeText(getProviderFromMovement(movement)) !== normalizeText(provider)) return false;
      if (isMovementDeleted(movement)) return false;
      const movementMonth = getMonthYearFromMovement(movement);
      if (!targetMonths.has(movementMonth)) return false;
      return toComparableInvoice(getMovementInvoiceNumber(movement)) === toComparableInvoice(invoiceNumber);
    });

    if (duplicated) {
      const err = new Error("Ya existe una factura con ese número para este proveedor en los últimos meses");
      err.statusCode = 409;
      throw err;
    }
  }

  const docId = `${provider.slice(0, 3)} - ${dateText} - ${String(Date.now()).slice(-6)}`;

  const amount = isPayment ? round2(amountRaw * -1) : round2(amountRaw);

  const movementFields = {
    Title: "boutique",
    IDAux_FP: docId,
    BalancePostFactura_FP: 0,
    BalancePreFactura_FP: 0,
    NroFacturaCancelada_FP: cancelledInvoiceNumbers.join(" - "),
    NroFactura_FP: invoiceNumber || " - ",
    Proveedor_FP: provider,
    MontoTotal_FP: amount,
    Observaciones_FP: observation,
    User_FP: userName || "WebApp",
    Fecha_FP: dateText,
    FechaMesAno_FP: monthYear,
    FechaAno_FP: yearText,
    Hora_FP: timeText,
    Version_FP: "webapp",
    Status_FP: isPayment ? "Pago" : "Pendiente",
    Tipo_FP: type || (isPayment ? "Pago" : "Deuda"),
    FechaDateValue_FP: date.toISOString(),
  };

  await createListItem(client, siteId, LIST_IDS.facturaProveedores, movementFields);

  if (isPayment && cancelledInvoiceNumbers.length > 0) {
    await setInvoicesStatusByNumbers(client, siteId, provider, cancelledInvoiceNumbers, "Cancelada");
  }

  await attachProviderDocument(client, siteId, {
    attachmentDataUrl: reqBody?.attachmentDataUrl,
    docId,
  });

  const summary = await recomputeAndPersistProvider(client, siteId, provider);
  return { provider, summary };
}

async function updateMovement(client, siteId, reqBody) {
  const movementId = String(reqBody?.movementId || "").trim();
  if (!movementId) throw new Error("Falta movementId");

  const movementItemResponse = await client
    .api(`/sites/${siteId}/lists/${LIST_IDS.facturaProveedores}/items/${movementId}?$expand=fields`)
    .get();

  const movement = { ...(movementItemResponse.fields || {}), id: movementItemResponse.id };
  const provider = getProviderFromMovement(movement);

  const fields = {};

  if (reqBody?.date) {
    const d = new Date(reqBody.date);
    if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida");
    fields.Fecha_FP = toDdMmYyyy(d);
    fields.FechaMesAno_FP = toMmYyyy(d);
    fields.FechaAno_FP = String(d.getFullYear());
    fields.FechaDateValue_FP = d.toISOString();
  }

  if (reqBody?.amount !== undefined) {
    const currentAmount = parseAmount(fieldValue(movement, ["MontoTotal_FP"], 0));
    const amountAbs = parseAmount(reqBody.amount);
    if (!Number.isFinite(amountAbs) || amountAbs <= 0) throw new Error("Monto inválido");
    fields.MontoTotal_FP = currentAmount < 0 ? round2(amountAbs * -1) : round2(amountAbs);
  }

  if (reqBody?.invoiceNumber !== undefined) {
    fields.NroFactura_FP = String(reqBody.invoiceNumber || " - ").trim() || " - ";
  }

  if (reqBody?.type !== undefined) {
    fields.Tipo_FP = String(reqBody.type || "").trim();
  }

  if (reqBody?.observation !== undefined) {
    fields.Observaciones_FP = String(reqBody.observation || "").trim();
  }

  if (reqBody?.status !== undefined) {
    fields.Status_FP = String(reqBody.status || "Pendiente").trim();
  }

  if (reqBody?.cancelledInvoiceNumbers !== undefined) {
    const values = Array.isArray(reqBody.cancelledInvoiceNumbers)
      ? reqBody.cancelledInvoiceNumbers.map((n) => String(n).trim()).filter(Boolean)
      : [];
    fields.NroFacturaCancelada_FP = values.join(" - ");
  }

  if (Object.keys(fields).length > 0) {
    await updateListItemFields(client, siteId, LIST_IDS.facturaProveedores, movementId, fields);
  }

  if (reqBody?.attachmentDataUrl) {
    const docId = String(fieldValue(movement, ["IDAux_FP"], `${provider.slice(0, 3)}-${movementId}`));
    await attachProviderDocument(client, siteId, {
      attachmentDataUrl: reqBody.attachmentDataUrl,
      docId,
    });
  }

  const summary = await recomputeAndPersistProvider(client, siteId, provider);
  return { provider, summary };
}

async function deleteMovementAndRecompute(client, siteId, movementId) {
  const movementItemResponse = await client
    .api(`/sites/${siteId}/lists/${LIST_IDS.facturaProveedores}/items/${movementId}?$expand=fields`)
    .get();

  const movement = { ...(movementItemResponse.fields || {}), id: movementItemResponse.id };
  const provider = getProviderFromMovement(movement);

  await deleteListItem(client, siteId, LIST_IDS.facturaProveedores, movementId);
  const summary = await recomputeAndPersistProvider(client, siteId, provider);
  return { provider, summary };
}

export default async function handler(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    jwt.verify(token, getJwtSecret());
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const siteId = getSiteId();
    const client = await getGraphClient();

    if (req.method === "GET") {
      const provider = String(req.query?.provider || "").trim();
      if (provider) {
        const detail = await getProviderDetail(client, siteId, provider);
        return res.status(200).json({ success: true, ...detail });
      }

      const providers = await getProvidersSummary(client, siteId);
      return res.status(200).json({ success: true, providers });
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "create").trim().toLowerCase();
      const userName = String(req.body?.userName || "WebApp").trim();

      if (action === "create") {
        const result = await createMovement(client, siteId, req.body, userName);
        return res.status(200).json({ success: true, ...result });
      }

      if (action === "update") {
        const result = await updateMovement(client, siteId, req.body);
        return res.status(200).json({ success: true, ...result });
      }

      if (action === "delete") {
        const movementId = String(req.body?.movementId || "").trim();
        if (!movementId) {
          return res.status(400).json({ error: "Falta movementId" });
        }
        const result = await deleteMovementAndRecompute(client, siteId, movementId);
        return res.status(200).json({ success: true, ...result });
      }

      return res.status(400).json({ error: "Acción inválida" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Accounts API Error:", error?.message || error);
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({ error: error?.message || "Error interno de Cuenta Corriente" });
  }
}
