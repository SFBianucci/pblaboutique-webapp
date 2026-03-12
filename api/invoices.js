import jwt from "jsonwebtoken";
import { getGraphClient, getSiteId, getJwtSecret, fetchAllListItems } from "./lib/graph-client.js";
import { LIST_IDS } from "./lib/constants.js";

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const mapUiStatusToBackendStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "paid" || normalized === "cobrada") return "Cobrada";
  if (normalized === "cancelada x nc" || normalized === "cancelada por nc") return "Cancelada x NC";
  if (normalized === "deleted" || normalized === "anulada") return "Anulada";
  if (normalized === "overdue" || normalized === "vencida") return "Vencida";
  if (normalized === "pending" || normalized === "pendiente") return "Pendiente";
  return "Pendiente";
};

const normalizeComparableText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isCreditNoteType = (invoiceType) => {
  const normalizedType = normalizeComparableText(invoiceType);
  return normalizedType.includes("nota de credito") || normalizedType.startsWith("nc");
};

const parseDateFromUi = (dateString) => {
  if (!dateString || typeof dateString !== "string") return null;
  const [dayRaw, monthRaw, yearRaw] = dateString.split("/");
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (!day || !month || !year) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatMonthYear = (date) => `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

const toNumberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toInvoiceNumber = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return 0;

  // If invoice has a point-of-sale prefix (e.g. 0002-10592), persist only the suffix.
  const suffix = raw.includes("-") ? String(raw.split("-").pop() || "").trim() : raw;
  const digitsOnly = suffix.replace(/\D/g, "");
  const number = Number(digitsOnly || suffix);
  return Number.isFinite(number) ? number : 0;
};

const toNormalizedInvoiceNumberText = (value) => {
  const parsed = toInvoiceNumber(value);
  return parsed ? String(parsed) : "";
};

const sanitizeFileName = (name) => {
  const base = String(name || "factura.pdf").trim() || "factura.pdf";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
};

const getBearerToken = (req) => {
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith("Bearer ")) return null;
  return authorization.split(" ")[1];
};

const getAttachmentDataUrl = (attachment) => {
  if (!attachment) return "";
  if (typeof attachment.fileDataUrl === "string" && attachment.fileDataUrl.trim()) {
    return attachment.fileDataUrl.trim();
  }
  if (typeof attachment.fileBase64 === "string" && attachment.fileBase64.trim()) {
    const mimeType = attachment.mimeType || "application/octet-stream";
    return `data:${mimeType};base64,${attachment.fileBase64.trim()}`;
  }
  return "";
};

async function fetchInvoiceItem(client, siteId, invoiceId) {
  const response = await client
    .api(`/sites/${siteId}/lists/${LIST_IDS.resumenFactura}/items/${invoiceId}?$expand=fields`)
    .get();

  return { ...(response.fields || {}), id: response.id };
}

const parseLinkedAttachment = (photoFields) => {
  if (!photoFields) return { fileName: "", fileDataUrl: "" };

  const rawDocument =
    photoFields.DocumentoFactura_FFS ??
    photoFields.DocumentoFactura ??
    photoFields.documentofactura_ffs;

  const fileDataUrl = typeof rawDocument === "string" ? rawDocument.trim() : "";

  const rawPdfField = photoFields.PDFFactura_FFS;
  let fileName = "";
  if (typeof rawPdfField === "string" && rawPdfField.trim() && rawPdfField !== "true" && rawPdfField !== "false") {
    fileName = rawPdfField.trim();
  } else if (fileDataUrl.toLowerCase().startsWith("data:application/pdf") || fileDataUrl.toLowerCase().includes(".pdf")) {
    fileName = "Factura.pdf";
  } else {
    fileName = String(photoFields.Title || "").trim();
  }

  return { fileName, fileDataUrl };
};

async function fetchLatestAttachmentByInvoiceId(client, siteId, invoiceId) {
  const safeInvoiceId = String(invoiceId || "").trim();
  if (!safeInvoiceId) return { fileName: "", fileDataUrl: "" };

  const escapedInvoiceId = safeInvoiceId.replace(/'/g, "''");
  const response = await client
    .api(`/sites/${siteId}/lists/${LIST_IDS.fotoFacturaSeguros}/items?$expand=fields&$filter=fields/IDFactura_FFS eq '${escapedInvoiceId}'&$orderby=id desc&$top=1`)
    .header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly")
    .get();

  const latest = response.value?.[0]?.fields;
  return parseLinkedAttachment(latest);
}

const parseInvoiceDateFromFields = (invoice) => {
  const directDate = invoice.FechaDateValue_RF || invoice.FechaDateValue;
  if (directDate) {
    const parsed = new Date(directDate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const textDate = String(invoice.Fecha_RF || "").trim();
  const match = textDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mapStatusFilter = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pending") return ["pendiente"];
  if (normalized === "paid") return ["cobrada"];
  if (normalized === "deleted") return ["anulada", "vencida", "cancelada x nc", "cancelada"];
  return [];
};

async function markInvoiceAsCancelledByNc(client, siteId, targetInvoiceNumber, ncInvoiceNumber, ncInvoiceId) {
  const targetNumber = toInvoiceNumber(targetInvoiceNumber);
  if (!targetNumber) return;

  const allResumen = await fetchAllListItems(client, siteId, LIST_IDS.resumenFactura);
  const match = allResumen.find((item) => {
    const currentNumber = Number(item.NroFactura_RF || 0);
    if (!Number.isFinite(currentNumber) || currentNumber !== targetNumber) return false;
    if (ncInvoiceId && String(item.id) === String(ncInvoiceId)) return false;
    return true;
  });

  if (!match?.id) return;

  await client
    .api(`/sites/${siteId}/lists/${LIST_IDS.resumenFactura}/items/${match.id}/fields`)
    .patch({
      Status_RF: "Cancelada x NC",
      NroFacturaCancelacion_RF: toNormalizedInvoiceNumberText(ncInvoiceNumber),
    });
}

async function findInvoiceByNumber(client, siteId, targetInvoiceNumber, excludeInvoiceId) {
  const targetNumber = toInvoiceNumber(targetInvoiceNumber);
  if (!targetNumber) return null;

  const allResumen = await fetchAllListItems(client, siteId, LIST_IDS.resumenFactura);
  return (
    allResumen.find((item) => {
      const currentNumber = Number(item.NroFactura_RF || 0);
      if (!Number.isFinite(currentNumber) || currentNumber !== targetNumber) return false;
      if (excludeInvoiceId && String(item.id) === String(excludeInvoiceId)) return false;
      return true;
    }) || null
  );
}

const parseMultiQueryParam = (rawValue) => {
  const normalized = String(rawValue || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return [];

  return normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

async function uploadPdfToDocumentLibrary(client, siteId, invoiceId, attachment) {
  const base64Data = String(attachment?.fileBase64 || "").trim();
  if (!base64Data) return null;

  const fileName = sanitizeFileName(attachment.fileName || `factura-${invoiceId}.pdf`);
  const safePath = `FacturasSeguros/${invoiceId}/${fileName}`;
  const binary = Buffer.from(base64Data, "base64");

  const driveItem = await client
    .api(`/sites/${siteId}/drive/root:/${safePath}:/content`)
    .header("Content-Type", "application/pdf")
    .put(binary);

  return driveItem;
}

async function upsertInvoiceAttachment(client, siteId, invoiceId, attachment, removeAttachment) {
  const safeInvoiceId = String(invoiceId || "").trim();
  if (!safeInvoiceId) return null;

  const escapedInvoiceId = safeInvoiceId.replace(/'/g, "''");
  const existingResponse = await client
    .api(`/sites/${siteId}/lists/${LIST_IDS.fotoFacturaSeguros}/items?$expand=fields&$filter=fields/IDFactura_FFS eq '${escapedInvoiceId}'&$orderby=id desc&$top=1`)
    .header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly")
    .get();

  const existing = existingResponse.value?.[0] || null;

  if (removeAttachment) {
    if (!existing) return null;
    await client
      .api(`/sites/${siteId}/lists/${LIST_IDS.fotoFacturaSeguros}/items/${existing.id}/fields`)
      .patch({
        DocumentoFactura_FFS: "",
        PDFFactura_FFS: "",
      });
    return { fileName: "", fileDataUrl: "" };
  }

  if (!attachment) return null;

  const fileName = String(attachment.fileName || "").trim();
  const mimeType = String(attachment.mimeType || "").trim().toLowerCase();
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  let fileDataUrl = getAttachmentDataUrl(attachment);

  if (isPdf) {
    try {
      const uploaded = await uploadPdfToDocumentLibrary(client, siteId, safeInvoiceId, attachment);
      const bestUrl = uploaded?.webUrl || uploaded?.["@microsoft.graph.downloadUrl"];
      if (bestUrl) {
        fileDataUrl = bestUrl;
      }
    } catch (error) {
      // Fallback: preserve base64/dataURL record when Document Library upload fails.
      console.error("PDF upload fallback to list storage:", error?.message || error);
    }
  }

  const photoFields = {
    Title: "Boutique",
    IDFactura_FFS: safeInvoiceId,
    DocumentoFactura_FFS: fileDataUrl,
    PDFFactura_FFS: fileName,
  };

  if (existing) {
    await client
      .api(`/sites/${siteId}/lists/${LIST_IDS.fotoFacturaSeguros}/items/${existing.id}/fields`)
      .patch(photoFields);
  } else {
    await client
      .api(`/sites/${siteId}/lists/${LIST_IDS.fotoFacturaSeguros}/items`)
      .post({ fields: photoFields });
  }

  return {
    fileName,
    fileDataUrl,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") {
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

    if (req.method === "PATCH") {
      const invoiceId = String(req.body?.id || "").trim();
      const status = String(req.body?.status || "").trim();

      if (!invoiceId) {
        return res.status(400).json({ error: "Falta el ID de la factura" });
      }

      if (!status) {
        return res.status(400).json({ error: "Falta el estado de la factura" });
      }

      const backendStatus = mapUiStatusToBackendStatus(status);

      await client
        .api(`/sites/${siteId}/lists/${LIST_IDS.resumenFactura}/items/${invoiceId}/fields`)
        .patch({
          Status_RF: backendStatus,
        });

      const savedItem = await fetchInvoiceItem(client, siteId, invoiceId);

      return res.status(200).json({
        success: true,
        invoice: savedItem,
      });
    }

    if (req.method === "GET") {
      const requestedId = String(req.query?.id || "").trim();
      if (requestedId) {
        const invoiceItem = await fetchInvoiceItem(client, siteId, requestedId);
        const attachment = await fetchLatestAttachmentByInvoiceId(client, siteId, requestedId);

        return res.status(200).json({
          success: true,
          invoice: {
            ...invoiceItem,
            fileName: attachment.fileName,
            fileDataUrl: attachment.fileDataUrl,
          },
        });
      }

      const fromRaw = String(req.query?.from || "").trim();
      const toRaw = String(req.query?.to || "").trim();
      const statusRaw = String(req.query?.status || "all").trim().toLowerCase();
      const insuranceRaw = String(req.query?.insurance || "all").trim();

      const fromDate = fromRaw ? new Date(`${fromRaw}T00:00:00`) : null;
      const toDate = toRaw ? new Date(`${toRaw}T23:59:59`) : null;
      const validFromDate = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
      const validToDate = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;
      const requestedStatuses = parseMultiQueryParam(statusRaw);
      const allowedStatusParts = requestedStatuses.flatMap((status) => mapStatusFilter(status));
      const requestedInsurances = parseMultiQueryParam(insuranceRaw);
      const requestedInsuranceSet = new Set(requestedInsurances);

      const allResumen = await fetchAllListItems(client, siteId, LIST_IDS.resumenFactura);

      const invoices = allResumen
        .filter((invoice) => {
          const invoiceDate = parseInvoiceDateFromFields(invoice);
          if (validFromDate && (!invoiceDate || invoiceDate < validFromDate)) return false;
          if (validToDate && (!invoiceDate || invoiceDate > validToDate)) return false;

          if (requestedStatuses.length > 0) {
            const status = String(invoice.Status_RF || invoice.Status_x0020_RF || "").trim().toLowerCase();
            if (!allowedStatusParts.some((part) => status.includes(part))) return false;
          }

          if (requestedInsuranceSet.size > 0) {
            const insurance = String(invoice.Seguro_RF || "").trim().toLowerCase();
            if (!requestedInsuranceSet.has(insurance)) return false;
          }

          return true;
        })
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      return res.status(200).json({
        success: true,
        invoices,
      });
    }

    const { invoice, id } = req.body || {};
    if (!invoice || typeof invoice !== "object") {
      return res.status(400).json({ error: "Faltan datos de factura" });
    }

    const issueDate = parseDateFromUi(invoice.date);
    if (!issueDate) {
      return res.status(400).json({ error: "Fecha de factura invalida" });
    }

    const invoiceNumber = String(invoice.invoiceNumber || "").trim();
    const insurance = String(invoice.insurance || "").trim();
    if (!invoiceNumber || !insurance) {
      return res.status(400).json({ error: "Numero de comprobante y seguro son obligatorios" });
    }

    const normalizedCancelledInvoiceNumber = toNormalizedInvoiceNumberText(invoice.cancelledInvoice);
    const shouldValidateCancelledInvoice =
      isCreditNoteType(invoice.type) && Boolean(normalizedCancelledInvoiceNumber);

    if (shouldValidateCancelledInvoice) {
      const matchedInvoice = await findInvoiceByNumber(client, siteId, normalizedCancelledInvoiceNumber, id);
      if (!matchedInvoice?.id) {
        return res.status(400).json({
          error: `No existe una factura con el numero ${normalizedCancelledInvoiceNumber} para cancelar.`,
        });
      }
    }

    const now = new Date();
    const issueMonth = issueDate.getMonth();
    const issueYear = issueDate.getFullYear();

    const commonFields = {
      Fecha_RF: invoice.date,
      FechaAno_RF: String(issueYear),
      FechaMes_RF: MONTH_NAMES_ES[issueMonth],
      FechaMesAno_RF: formatMonthYear(issueDate),
      FechaDateValue_RF: issueDate.toISOString(),
      Hora_RF: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      User_RF: authPayload?.Title || authPayload?.username || "",
      NroFactura_RF: toInvoiceNumber(invoice.invoiceNumber),
      Seguro_RF: insurance,
      Patente_RF: String(invoice.licensePlate || "").toUpperCase(),
      TipoFactura_RF: String(invoice.type || "Factura"),
      Subtotal_RF: toNumberOrZero(invoice.subtotal),
      Total_RF: toNumberOrZero(invoice.amount),
      IVA_RF: toNumberOrZero(invoice.vat),
      Siniestro_RF: String(invoice.siniestro || ""),
      Servicio_RF: String(invoice.description || "").toUpperCase(),
      NroFacturaCancelacion_RF: normalizedCancelledInvoiceNumber,
    };

    let invoiceId = String(id || "").trim();

    if (req.method === "POST") {
      const createResponse = await client
        .api(`/sites/${siteId}/lists/${LIST_IDS.resumenFactura}/items`)
        .post({
          fields: {
            ...commonFields,
            Title: "boutique",
            Status_RF: mapUiStatusToBackendStatus(invoice.status),
          },
        });

      invoiceId = createResponse.id;

      if (isCreditNoteType(invoice.type) && normalizedCancelledInvoiceNumber) {
        await markInvoiceAsCancelledByNc(
          client,
          siteId,
          normalizedCancelledInvoiceNumber,
          invoice.invoiceNumber,
          invoiceId,
        );
      }
    } else {
      if (!invoiceId) {
        return res.status(400).json({ error: "Falta el ID de la factura a editar" });
      }

      await client
        .api(`/sites/${siteId}/lists/${LIST_IDS.resumenFactura}/items/${invoiceId}/fields`)
        .patch(commonFields);

      if (isCreditNoteType(invoice.type) && normalizedCancelledInvoiceNumber) {
        await markInvoiceAsCancelledByNc(
          client,
          siteId,
          normalizedCancelledInvoiceNumber,
          invoice.invoiceNumber,
          invoiceId,
        );
      }
    }

    const attachmentResult = await upsertInvoiceAttachment(
      client,
      siteId,
      invoiceId,
      invoice.attachment,
      Boolean(invoice.removeAttachment),
    );

    const savedItem = await fetchInvoiceItem(client, siteId, invoiceId);
    const responseInvoice = {
      ...savedItem,
      fileName: attachmentResult?.fileName || invoice.fileName || "",
      fileDataUrl: attachmentResult?.fileDataUrl || invoice.fileDataUrl || "",
    };

    return res.status(200).json({
      success: true,
      invoice: responseInvoice,
    });
  } catch (error) {
    console.error("Invoices API Error:", error?.message || error);
    return res.status(500).json({ error: "Error interno al guardar la factura" });
  }
}
