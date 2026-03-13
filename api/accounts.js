import jwt from "jsonwebtoken";
import { getGraphClient, getSiteId, getJwtSecret, fetchAllListItems } from "./lib/graph-client.js";
import { LIST_IDS } from "./lib/constants.js";

const PROVIDER_ATTACHMENTS_FOLDER = "CuentaCorrienteAdjuntos";

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

const parseCancelledInvoiceNumbers = (value) =>
  String(value || "")
    .split(" - ")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

const dedupeInvoiceNumbers = (values) => {
  const deduped = new Map();
  (Array.isArray(values) ? values : []).forEach((invoice) => {
    const raw = String(invoice || "").trim();
    if (!raw) return;
    const comparable = toComparableInvoice(raw);
    if (!comparable || deduped.has(comparable)) return;
    deduped.set(comparable, raw);
  });
  return Array.from(deduped.values());
};

const isCreditNoteType = (value) => normalizeText(value) === "nota de credito";

const resolveCancelledInvoicesForPayment = ({
  provider,
  type,
  invoiceNumber,
  cancelledInvoiceNumbers,
  movements,
}) => {
  const manual = dedupeInvoiceNumbers(cancelledInvoiceNumbers);
  if (!isCreditNoteType(type)) return manual;
  if (manual.length > 0) return manual;

  const comparableTarget = toComparableInvoice(invoiceNumber);
  if (!comparableTarget) return manual;

  const normalizedProvider = normalizeText(provider);
  const autoMatched = movements
    .filter((movement) => {
      if (normalizeText(getProviderFromMovement(movement)) !== normalizedProvider) return false;
      if (isMovementDeleted(movement)) return false;
      if (parseAmount(fieldValue(movement, ["MontoTotal_FP"], 0)) <= 0) return false;
      if (normalizeText(getMovementStatus(movement)) !== "pendiente") return false;
      return toComparableInvoice(getMovementInvoiceNumber(movement)) === comparableTarget;
    })
    .map((movement) => getMovementInvoiceNumber(movement));

  return dedupeInvoiceNumbers([...manual, ...autoMatched]);
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

async function fetchProviderDocuments(client, siteId) {
  return fetchAllListItems(client, siteId, LIST_IDS.fotoFacturaProveedores);
}

const sanitizePathSegment = (value) =>
  String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&+]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);

const docDrivePath = (docId) => {
  const safe = sanitizePathSegment(docId);
  if (!safe) return "";
  return `${PROVIDER_ATTACHMENTS_FOLDER}/${safe}`;
};

const parseDataUrlPayload = (dataUrl) => {
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) return null;
  return {
    mimeType: String(match[1] || "application/octet-stream").toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
};

async function uploadProviderDocumentToDrive(client, siteId, payload) {
  const docId = String(payload?.docId || "").trim();
  const fileDataUrl = String(payload?.attachmentDataUrl || "").trim();
  if (!docId || !fileDataUrl) return;

  const parsed = parseDataUrlPayload(fileDataUrl);
  if (!parsed || !parsed.buffer?.length) return;

  const path = docDrivePath(docId);
  if (!path) return;

  await client
    .api(`/sites/${siteId}/drive/root:/${path}:/content`)
    .header("Content-Type", parsed.mimeType || "application/octet-stream")
    .put(parsed.buffer);
}

async function fetchProviderDocumentFromDrive(client, siteId, docId) {
  const path = docDrivePath(docId);
  if (!path) return null;

  try {
    const driveItem = await client.api(`/sites/${siteId}/drive/root:/${path}`).get();
    const downloadUrl = driveItem?.["@microsoft.graph.downloadUrl"];
    if (!downloadUrl) return null;

    const response = await fetch(downloadUrl);
    if (!response.ok) return null;

    const mimeType = String(
      response.headers.get("content-type") || driveItem?.file?.mimeType || "application/octet-stream",
    ).toLowerCase();
    const bytes = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;

    return {
      attachmentDataUrl: dataUrl,
      attachmentMimeType: mimeType,
      attachmentName: String(driveItem?.name || docId || "adjunto").trim(),
    };
  } catch (error) {
    if (Number(error?.statusCode) === 404) return null;
    throw error;
  }
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

const dataUrlMimeType = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:([^;,]+)[;,]/i);
  return match?.[1] || "";
};

const mapMovementForUi = (ledgerRow, attachmentsByDocId = new Map()) => {
  const { movement, amount, deleted, balancePre, balancePost, runningDebt, runningCredit } = ledgerRow;
  const status = getMovementStatus(movement);
  const docId = String(fieldValue(movement, ["IDAux_FP"], "")).trim();
  const attachmentDataUrl = docId ? String(attachmentsByDocId.get(docId) || "") : "";
  const mimeType = dataUrlMimeType(attachmentDataUrl);
  const inferredExtension = mimeType.includes("pdf") ? "pdf" : (mimeType.split("/")[1] || "jpg");
  const invoiceNumber = getMovementInvoiceNumber(movement);

  return {
    id: String(movement.id),
    provider: getProviderFromMovement(movement),
    date: fieldValue(movement, ["Fecha_FP"], toDdMmYyyy(parseDateFlexible(movement))),
    monthYear: getMonthYearFromMovement(movement),
    invoiceNumber,
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
    docId,
    hasAttachment: Boolean(attachmentDataUrl),
    attachmentDataUrl,
    attachmentMimeType: mimeType,
    attachmentName: attachmentDataUrl ? `${invoiceNumber || docId || "adjunto"}.${inferredExtension}` : "",
  };
};

async function getProvidersSummary(client, siteId) {
  const [accounts, movements] = await Promise.all([
    fetchAccounts(client, siteId),
    fetchMovements(client, siteId),
  ]);

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

  const [accounts, movements, documents] = await Promise.all([
    fetchAccounts(client, siteId),
    fetchMovements(client, siteId),
    fetchProviderDocuments(client, siteId),
  ]);

  const account = accounts.find((acc) => normalizeText(getProviderFromAccount(acc)) === normalizeText(provider));
  const effectiveProvider = account ? getProviderFromAccount(account) : provider;

  const { ledger, summary } = computeLedgerForProvider(movements, effectiveProvider);

  const docIds = new Set(
    ledger
      .map((entry) => String(fieldValue(entry.movement, ["IDAux_FP"], "")).trim())
      .filter(Boolean),
  );

  const attachmentsByDocId = new Map();
  documents.forEach((documentItem) => {
    const attachmentDocId = String(fieldValue(documentItem, ["IDFacturaProveedor_FP"], "")).trim();
    if (!attachmentDocId || !docIds.has(attachmentDocId)) return;

    const dataUrl = String(fieldValue(documentItem, ["FotoFactura_FP"], "")).trim();
    if (!dataUrl) return;

    const current = attachmentsByDocId.get(attachmentDocId);
    if (!current || Number(documentItem.id) > Number(current.id)) {
      attachmentsByDocId.set(attachmentDocId, { id: documentItem.id, dataUrl });
    }
  });

  const dataUrlByDocId = new Map(
    Array.from(attachmentsByDocId.entries()).map(([docId, value]) => [docId, value.dataUrl]),
  );

  const uiMovements = ledger
    .map((row) => mapMovementForUi(row, dataUrlByDocId))
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
  await uploadProviderDocumentToDrive(client, siteId, payload);
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
  const effectiveCancelledInvoiceNumbers = isPayment
    ? resolveCancelledInvoicesForPayment({
        provider,
        type,
        invoiceNumber,
        cancelledInvoiceNumbers,
        movements,
      })
    : [];

  const movementFields = {
    Title: "boutique",
    IDAux_FP: docId,
    BalancePostFactura_FP: 0,
    BalancePreFactura_FP: 0,
    NroFacturaCancelada_FP: effectiveCancelledInvoiceNumbers.join(" - "),
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

  if (isPayment && effectiveCancelledInvoiceNumbers.length > 0) {
    await setInvoicesStatusByNumbers(client, siteId, provider, effectiveCancelledInvoiceNumbers, "Cancelada");
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
  const currentStatus = normalizeText(getMovementStatus(movement));
  const currentAmount = parseAmount(fieldValue(movement, ["MontoTotal_FP"], 0));
  const isPaymentMovement = currentAmount < 0;
  const currentType = String(fieldValue(movement, ["Tipo_FP"], currentAmount < 0 ? "Pago" : "Deuda")).trim();
  const currentInvoiceNumber = String(fieldValue(movement, ["NroFactura_FP"], "")).trim();
  const previousCancelledInvoiceNumbers = parseCancelledInvoiceNumbers(
    fieldValue(movement, ["NroFacturaCancelada_FP"], ""),
  );

  if (currentStatus === "cancelada") {
    const hasNonStatusEdits = [
      "date",
      "amount",
      "invoiceNumber",
      "type",
      "observation",
      "cancelledInvoiceNumbers",
      "attachmentDataUrl",
    ].some((key) => reqBody?.[key] !== undefined);

    const requestedStatus = reqBody?.status !== undefined ? normalizeText(reqBody.status) : "";
    const isValidRevert = requestedStatus === "pendiente";

    if (hasNonStatusEdits || !isValidRevert) {
      const err = new Error("Las facturas canceladas no se pueden editar. Solo se pueden revertir a Pendiente.");
      err.statusCode = 409;
      throw err;
    }
  }

  const fields = {};
  const shouldReevaluateCancelledInvoices =
    isPaymentMovement &&
    (reqBody?.cancelledInvoiceNumbers !== undefined || reqBody?.type !== undefined || reqBody?.invoiceNumber !== undefined);

  let nextCancelledInvoiceNumbers = [...previousCancelledInvoiceNumbers];

  if (shouldReevaluateCancelledInvoices) {
    const movements = await fetchMovements(client, siteId);
    const requestedCancelledInvoiceNumbers =
      reqBody?.cancelledInvoiceNumbers !== undefined
        ? Array.isArray(reqBody.cancelledInvoiceNumbers)
          ? reqBody.cancelledInvoiceNumbers.map((n) => String(n || "")).filter(Boolean)
          : []
        : previousCancelledInvoiceNumbers;

    const nextType = reqBody?.type !== undefined ? String(reqBody.type || "").trim() : currentType;
    const nextInvoiceNumber =
      reqBody?.invoiceNumber !== undefined ? String(reqBody.invoiceNumber || "").trim() : currentInvoiceNumber;

    nextCancelledInvoiceNumbers = resolveCancelledInvoicesForPayment({
      provider,
      type: nextType,
      invoiceNumber: nextInvoiceNumber,
      cancelledInvoiceNumbers: requestedCancelledInvoiceNumbers,
      movements,
    });

    fields.NroFacturaCancelada_FP = nextCancelledInvoiceNumbers.join(" - ");
  }

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

  if (Object.keys(fields).length > 0) {
    await updateListItemFields(client, siteId, LIST_IDS.facturaProveedores, movementId, fields);
  }

  if (shouldReevaluateCancelledInvoices) {
    const previousSet = new Set(previousCancelledInvoiceNumbers.map((inv) => toComparableInvoice(inv)).filter(Boolean));
    const nextSet = new Set(nextCancelledInvoiceNumbers.map((inv) => toComparableInvoice(inv)).filter(Boolean));

    const removed = previousCancelledInvoiceNumbers.filter((inv) => !nextSet.has(toComparableInvoice(inv)));
    const added = nextCancelledInvoiceNumbers.filter((inv) => !previousSet.has(toComparableInvoice(inv)));

    if (removed.length > 0) {
      await setInvoicesStatusByNumbers(client, siteId, provider, removed, "Pendiente");
    }

    if (added.length > 0) {
      await setInvoicesStatusByNumbers(client, siteId, provider, added, "Cancelada");
    }
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

      if (action === "getattachment") {
        const docId = String(req.body?.docId || "").trim();
        if (!docId) {
          return res.status(400).json({ error: "Falta docId" });
        }

        const document = await fetchProviderDocumentFromDrive(client, siteId, docId);
        return res.status(200).json({ success: true, found: Boolean(document), ...(document || {}) });
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
