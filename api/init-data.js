import jwt from "jsonwebtoken";
import { getGraphClient, getSiteId, getJwtSecret, fetchAllListItems } from "./lib/graph-client.js";
import { LIST_IDS } from "./lib/constants.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authorization.split(" ")[1];
    try {
        jwt.verify(token, getJwtSecret());
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    try {
        const siteId = getSiteId();
        const client = await getGraphClient();

        const now = new Date();
        const toMonthYear = (date) => `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const targetMonthYears = new Set([toMonthYear(now), toMonthYear(prevMonthDate)]);

        const normalizeMonthYear = (value) => {
            if (typeof value !== "string") return null;
            const trimmed = value.trim();
            const match = trimmed.match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
            if (!match) return null;
            const month = match[1].padStart(2, "0");
            return `${month}/${match[2]}`;
        };

        const getInvoiceMonthYear = (invoice) => {
            const preferredKeys = [
                "FechaMesAno_RF",
                "FechaMesAno",
                "Fecha_x0020_Mes_x002f_A_x00f1_o_RF",
                "Fecha_x0020_Mes_x002f_A_x00f1_o",
            ];

            for (const key of preferredKeys) {
                const normalized = normalizeMonthYear(invoice[key]);
                if (normalized) return normalized;
            }

            // Fallback for unexpected SharePoint internal names.
            for (const value of Object.values(invoice)) {
                const normalized = normalizeMonthYear(value);
                if (normalized) return normalized;
            }

            return null;
        };

        const fetchList = (listId) => fetchAllListItems(client, siteId, listId);

        const results = await Promise.all([
            fetchList(LIST_IDS.notasExpress),
            fetchList(LIST_IDS.tipoFactura),
            fetchList(LIST_IDS.seguros),
            fetchList(LIST_IDS.resumenFactura),
            fetchList(LIST_IDS.tipoStock),
            fetchList(LIST_IDS.turnos),
        ]);
        
        const [allNotas, allTipoFacturas, allSeguros, allResumen, allTipoStock, allTurnos] = results;

        // Filter active items (SharePoint uses either Status_XX or Status_x0020_XX field names)
        const isActive = (item, suffix) =>
            item[`Status_${suffix}`] === "Activo" || item[`Status_x0020_${suffix}`] === "Activo";

        const notasExpress = allNotas.filter(i => isActive(i, "NE"));

        const tipoFactura = allTipoFacturas
            .filter(i => isActive(i, "AT"))
            .sort((a, b) => (a.Order_AT || 0) - (b.Order_AT || 0));

        const seguros = allSeguros.filter(i => isActive(i, "AS"));

        // Resumen Factura: only current month and previous month (field is text MM/YYYY).
        const resumenFactura = allResumen
            .filter(inv => {
                const invoiceMonthYear = getInvoiceMonthYear(inv);
                return invoiceMonthYear ? targetMonthYears.has(invoiceMonthYear) : false;
            })
            .sort((a, b) => parseInt(b.id) - parseInt(a.id));

        const tipoStock = allTipoStock.filter(i => isActive(i, "ATS"));

        // Today's appointments (dd/mm/yyyy)
        const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const turnos = allTurnos.filter(i => i.Fecha_T === todayStr || i.Fecha_x0020_T === todayStr);

        // Week identifier: "yyyyWW"
        const getWeekNumber = (d) => {
            const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
            return Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
        };
        const semanaAux = `${now.getFullYear()}${getWeekNumber(now)}`;

        return res.status(200).json({
            success: true,
            notasExpress,
            tipoFactura,
            seguros,
            resumenFactura,
            tipoStock,
            turnos,
            semanaAux
        });

    } catch (error) {
        console.error("Init Data Error:", error.message);
        return res.status(500).json({ error: "Falló la inicialización de datos" });
    }
}
