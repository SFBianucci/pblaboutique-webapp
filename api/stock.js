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

const toMonthYear = (d) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const fmtDate = (d) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const fmtTime = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/* ── handler ─────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let authPayload;
  try {
    authPayload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const userName = authPayload?.username || authPayload?.Title || "";

  try {
    const siteId = getSiteId();
    const client = await getGraphClient();

    /* ================================================================
       GET  /api/stock?tipo=Parabrisas
       Returns stock items filtered by type + recent salida for out-of-stock check
       ================================================================ */
    if (req.method === "GET") {
      const { tipo } = req.query;

      // Fetch stock filtered server-side via OData (mucho más rápido)
      const stockUrl = tipo
        ? `/sites/${siteId}/lists/${LIST_IDS.stock}/items?$expand=fields&$top=999&$filter=fields/Tipo_ST eq '${tipo}' and fields/Status_ST eq 'Activo'`
        : `/sites/${siteId}/lists/${LIST_IDS.stock}/items?$expand=fields&$top=999&$filter=fields/Status_ST eq 'Activo'`;

      let stockRaw = [];
      try {
        let response = await client.api(stockUrl).header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly").get();
        stockRaw = response.value || [];
        while (response["@odata.nextLink"]) {
          response = await client.api(response["@odata.nextLink"]).get();
          stockRaw = stockRaw.concat(response.value || []);
        }
      } catch (filterErr) {
        // Fallback: si el filtro OData falla (columna no indexada con +5000 items), traer todo
        console.warn("OData filter failed, falling back to full fetch:", filterErr.message);
        const allStock = await fetchAllListItems(client, siteId, LIST_IDS.stock);
        stockRaw = allStock
          .filter((i) =>
            (i.Status_ST === "Activo" || i.Status_x0020_ST === "Activo") &&
            (!tipo || i.Tipo_ST === tipo || i.Tipo_x0020_ST === tipo)
          )
          .map((i) => ({ fields: i, id: i.id }));
      }
      const stockItems = stockRaw.map((item) => ({ ...(item.fields || {}), id: item.id }));

      // Fetch recent salida filtered by tipo
      const now = new Date();
      const currentMonth = toMonthYear(now);
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = toMonthYear(prev);

      let recentSalida = [];
      try {
        const salidaFilter = tipo
          ? `fields/TipoStock_SS eq '${tipo}' and (fields/FechaMesAno_SS eq '${currentMonth}' or fields/FechaMesAno_SS eq '${prevMonth}')`
          : `fields/FechaMesAno_SS eq '${currentMonth}' or fields/FechaMesAno_SS eq '${prevMonth}'`;
        const salidaUrl = `/sites/${siteId}/lists/${LIST_IDS.salidaStock}/items?$expand=fields&$top=999&$filter=${salidaFilter}`;
        let salidaResp = await client.api(salidaUrl).header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly").get();
        recentSalida = (salidaResp.value || []).map((item) => ({ ...(item.fields || {}), id: item.id }));
        while (salidaResp["@odata.nextLink"]) {
          salidaResp = await client.api(salidaResp["@odata.nextLink"]).get();
          recentSalida = recentSalida.concat((salidaResp.value || []).map((item) => ({ ...(item.fields || {}), id: item.id })));
        }
      } catch {
        const allSalidaItems = await fetchAllListItems(client, siteId, LIST_IDS.salidaStock);
        const targetMonths = new Set([currentMonth, prevMonth]);
        recentSalida = allSalidaItems.filter((s) => {
          const my = (s.FechaMesAno_SS || "").trim().replace(/^(\d)\//, "0$1/");
          return targetMonths.has(my) && (!tipo || s.TipoStock_SS === tipo);
        });
      }

      return res.status(200).json({
        success: true,
        stock: stockItems,
        recentSalida,
      });
    }

    /* ================================================================
       PATCH  /api/stock   { action: "editQty", id, newQty, prevQty }
       Edit quantity of a single stock item + log to backlog
       ================================================================ */
    if (req.method === "PATCH") {
      const { action, id, newQty, prevQty, articulo, tipo } = req.body;

      if (action === "editQty") {
        // Update stock quantity
        await client
          .api(`/sites/${siteId}/lists/${LIST_IDS.stock}/items/${id}/fields`)
          .patch({ Cantidad_ST: Number(newQty) });

        // Log to backlog (same structure as PowerApps)
        const now = new Date();
        try {
          const backlogFields = {
            Title: "boutique",
            UserMod_ST: String(userName || ""),
            Hora_ST: fmtTime(now),
            Articulo_ST: String(articulo || ""),
            Fecha_ST: fmtDate(now),
            CantidadAnterior_ST: String(prevQty),
            CantidadNueva_ST: String(newQty),
            FechaMesAno_ST: toMonthYear(now),
            FechaAno__ST: String(now.getFullYear()),
            Tipo_ST: String(tipo || ""),
          };
          console.log("Backlog fields:", JSON.stringify(backlogFields));
          await client
            .api(`/sites/${siteId}/lists/${LIST_IDS.backlogEditStock}/items`)
            .post({ fields: backlogFields });
        } catch (backlogErr) {
          console.error("Backlog write failed (non-blocking):", backlogErr.body || backlogErr.message || backlogErr);
        }

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Unknown PATCH action" });
    }

    /* ================================================================
       POST  /api/stock   { action: "ingreso" | "cierreDiario", ... }
       ================================================================ */
    if (req.method === "POST") {
      const { action } = req.body;
      const now = new Date();

      /* ── Ingreso de Stock ─────────────────────────────────────── */
      if (action === "ingreso") {
        const { items, observaciones } = req.body;
        // items: [{ tipo, articulo, cantIngresada, stockAnterior, stockTotal, stockId }]

        const idIngreso = `${userName.substring(0, 3)} - ${fmtDate(now)} - Ingreso`;

        // 1. Create ingreso header (07.IngresoStock)
        try {
          await client
            .api(`/sites/${siteId}/lists/${LIST_IDS.ingresoStock}/items`)
            .post({
              fields: {
                Title: "boutique",
                Fecha_IS: fmtDate(now),
                Unidades_IS: String(items.reduce((s, i) => s + Number(i.cantIngresada), 0)),
                Observaciones_IS: String(observaciones || ""),
                User_IS: String(userName || ""),
                Hora_IS: fmtTime(now),
                MesAno_IS: toMonthYear(now),
                Ano_IS: String(now.getFullYear()),
                Status_IS: "Activo",
                Aux_IS: idIngreso,
              },
            });
        } catch (err) {
          console.error("Error creating IngresoStock header:", err.body || err.message);
          throw err;
        }

        // 2. Create detail rows (08.DetalleIngresoStock) + update stock quantities
        for (const item of items) {
          try {
            await client
              .api(`/sites/${siteId}/lists/${LIST_IDS.detalleIngresoStock}/items`)
              .post({
                fields: {
                  Title: "boutique",
                  Tipo_DIS: String(item.tipo || ""),
                  ConcatArt_DIS: String(item.articulo || ""),
                  Cantidad_DIS: String(item.cantIngresada),
                  CantidadAnterior_DIS: String(item.stockAnterior),
                  CantResultande_DIS: String(item.stockTotal),
                  User_DIS: String(userName || ""),
                  Fecha_DIS: fmtDate(now),
                  FechaMesAno_DIS: toMonthYear(now),
                  Ano_DIS: String(now.getFullYear()),
                  IDIngreso_DIS: idIngreso,
                },
              });
          } catch (err) {
            console.error("Error creating DetalleIngreso for:", item.articulo, err.body || err.message);
            throw err;
          }

          // Update stock quantity (05.Stock)
          await client
            .api(`/sites/${siteId}/lists/${LIST_IDS.stock}/items/${item.stockId}/fields`)
            .patch({ Cantidad_ST: Number(item.stockTotal) });
        }

        return res.status(200).json({ success: true });
      }

      /* ── Cierre Diario ────────────────────────────────────────── */
      if (action === "cierreDiario") {
        const { items, observaciones } = req.body;
        // items: [{ tipo, articulo, saliente, anterior, resultado, stockId }]

        const auxSalida = `Cierre Diario - ${userName} - ${fmtDate(now)}`;

        // 1. Create cierre diario header
        try {
          const cdFields = {
            Title: "boutique",
            User_CD: String(userName || ""),
            FechaMesAno_CD: toMonthYear(now),
            Fecha_CD: fmtDate(now),
            Hora_CD: fmtTime(now),
            CantSaliente_CD: String(items.reduce((s, i) => s + Number(i.saliente), 0)),
            Observaciones_CD: String(observaciones || ""),
            Aux_CD: auxSalida,
          };
          console.log("CierreDiario fields:", JSON.stringify(cdFields));
          await client
            .api(`/sites/${siteId}/lists/${LIST_IDS.cierreDiario}/items`)
            .post({ fields: cdFields });
        } catch (err) {
          console.error("Error creating CierreDiario header:", err.body || err.message);
          throw err;
        }

        // 2. Create salida rows + update stock quantities
        for (const item of items) {
          try {
            const ssFields = {
              Title: "boutique",
              TipoStock_SS: String(item.tipo || ""),
              User_SS: String(userName || ""),
              FechaMesAno_SS: toMonthYear(now),
              Fecha_SS: fmtDate(now),
              FechaAno_SS: String(now.getFullYear()),
              Hora_SS: fmtTime(now),
              Articulo_SS: String(item.articulo || ""),
              CantidadAnterior_SS: String(item.anterior),
              CantidadResultante_SS: String(item.resultado),
              CantidadSaliente_SS: String(item.saliente),
              Aux_SS: auxSalida,
            };
            await client
              .api(`/sites/${siteId}/lists/${LIST_IDS.salidaStock}/items`)
              .post({ fields: ssFields });
          } catch (err) {
            console.error("Error creating SalidaStock for:", item.articulo, err.body || err.message);
            throw err;
          }

          // Update stock quantity
          await client
            .api(`/sites/${siteId}/lists/${LIST_IDS.stock}/items/${item.stockId}/fields`)
            .patch({ Cantidad_ST: Number(item.resultado) });
        }

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Unknown POST action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Stock API Error:", error);
    return res.status(500).json({ error: error?.message || "Error interno del servidor" });
  }
}
