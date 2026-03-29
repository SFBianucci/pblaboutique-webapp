import jwt from "jsonwebtoken";
import {
  getGraphClient,
  getSiteId,
  getJwtSecret,
  fetchAllListItems,
} from "./lib/graph-client.js";
import { LIST_IDS } from "./lib/constants.js";

/* ── helpers ─────────────────────────────────────────────────────── */

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/**
 * Parse "dd/mm/yyyy" → Date (start of day, local).
 * Returns null when the string is empty / malformed.
 */
function parseDDMMYYYY(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

/**
 * Returns true when `fechaStr` (dd/mm/yyyy) falls within [from, to] inclusive.
 * If from or to is null the bound is ignored.
 */
function isInDateRange(fechaStr, from, to) {
  const d = parseDDMMYYYY(fechaStr);
  if (!d) return true; // keep rows with missing/unparseable dates
  if (from && d < from) return false;
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    if (d > toEnd) return false;
  }
  return true;
}

/* ── handler ─────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const siteId = getSiteId();
    const client = await getGraphClient();

    const { reportType, tipo, from, to } = req.query;
    const ingresoId = (req.query.ingresoId || "").replace(/\+/g, " ");
    const cierreId = (req.query.cierreId || "").replace(/\+/g, " ");
    const fromDate = parseDDMMYYYY(from);
    const toDate = parseDDMMYYYY(to);

    /* ── Ingresos ───────────────────────────────────────────────── */
    if (reportType === "ingresos") {
      // Detail request
      if (ingresoId) {
        const allDetail = await fetchAllListItems(client, siteId, LIST_IDS.detalleIngresoStock);
        const normalizedId = String(ingresoId || "").trim();
        const filtered = allDetail.filter(
          (r) => String(r.IDIngreso_DIS || "").trim() === normalizedId
        );
        return res.status(200).json({ success: true, detail: filtered });
      }

      // Header list
      const allHeaders = await fetchAllListItems(client, siteId, LIST_IDS.ingresoStock);

      let filtered = allHeaders;

      // Date filter on Fecha_IS (dd/mm/yyyy)
      if (fromDate || toDate) {
        filtered = filtered.filter((r) =>
          isInDateRange(r.Fecha_IS, fromDate, toDate)
        );
      }

      // Tipo filter: we need to check detail rows
      if (tipo) {
        const allDetail = await fetchAllListItems(client, siteId, LIST_IDS.detalleIngresoStock);
        const ingresoIdsWithTipo = new Set(
          allDetail
            .filter((d) => d.Tipo_DIS === tipo)
            .map((d) => d.IDIngreso_DIS)
        );
        filtered = filtered.filter((r) => ingresoIdsWithTipo.has(r.Aux_IS));
      }

      // Sort by ID desc
      filtered.sort((a, b) => Number(b.id) - Number(a.id));

      return res.status(200).json({ success: true, rows: filtered });
    }

    /* ── Salidas ────────────────────────────────────────────────── */
    if (reportType === "salidas") {
      // Detail request
      if (cierreId) {
        const allSalida = await fetchAllListItems(client, siteId, LIST_IDS.salidaStock);
        const normalizedId = String(cierreId || "").trim();
        const filtered = allSalida.filter(
          (r) => String(r.Aux_SS || "").trim() === normalizedId
        );
        return res.status(200).json({ success: true, detail: filtered });
      }

      // Header list (cierre diario)
      const allHeaders = await fetchAllListItems(client, siteId, LIST_IDS.cierreDiario);

      let filtered = allHeaders;

      if (fromDate || toDate) {
        filtered = filtered.filter((r) =>
          isInDateRange(r.Fecha_CD, fromDate, toDate)
        );
      }

      if (tipo) {
        const allSalida = await fetchAllListItems(client, siteId, LIST_IDS.salidaStock);
        const cierreIdsWithTipo = new Set(
          allSalida
            .filter((s) => s.TipoStock_SS === tipo)
            .map((s) => s.Aux_SS)
        );
        filtered = filtered.filter((r) => cierreIdsWithTipo.has(r.Aux_CD));
      }

      filtered.sort((a, b) => Number(b.id) - Number(a.id));

      return res.status(200).json({ success: true, rows: filtered });
    }

    /* ── Ediciones ──────────────────────────────────────────────── */
    if (reportType === "ediciones") {
      const allEdits = await fetchAllListItems(client, siteId, LIST_IDS.backlogEditStock);

      let filtered = allEdits;

      if (fromDate || toDate) {
        filtered = filtered.filter((r) =>
          isInDateRange(r.Fecha_ST, fromDate, toDate)
        );
      }

      if (tipo) {
        filtered = filtered.filter((r) => r.Tipo_ST === tipo);
      }

      filtered.sort((a, b) => Number(b.id) - Number(a.id));

      return res.status(200).json({ success: true, rows: filtered });
    }

    return res.status(400).json({ error: "reportType inválido. Use: ingresos | salidas | ediciones" });
  } catch (error) {
    console.error("Stock Reports API Error:", error);
    return res.status(500).json({ error: error?.message || "Error interno del servidor" });
  }
}
