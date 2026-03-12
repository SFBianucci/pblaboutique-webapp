import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import jwt from "jsonwebtoken";

const LIST_IDS = {
    notasExpress: "2a449ffb-d7f9-42b3-a2e5-84798b17d3b9", // 17.NotasExpress
    tipoFactura: "e7b853f1-3aaa-4940-899a-ced8244318b2", // 99.ABM_TipoFactura
    seguros: "a9906d50-6ab2-4228-97f9-3d0367544a37", // 99.ABM_Seguros
    resumenFactura: "e691aa5d-1f3f-4597-a81a-0fb2af9c7fb5", // 01.ResumenFactura
    tipoStock: "f6f9feb4-422f-4c1f-abd3-357d3fd5d57e", // 99.ABM_TipoStock
    turnos: "968056ca-f6b4-47cc-9cc9-384d76da7c9c", // 15.Turnos
};

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authorization.split(" ")[1];
    let decodedToken;
    try {
        const jwtSecret = process.env.JWT_SECRET || "fallback_secret_for_local_dev_only";
        decodedToken = jwt.verify(token, jwtSecret);
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    const username = decodedToken.username;

    const SITE_ID = process.env.GRAPH_SITE_ID;
    if (!SITE_ID) {
        return res.status(500).json({ error: "Server Configuration Error" });
    }

    try {
        const msalConfig = {
            auth: {
                clientId: process.env.GRAPH_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}`,
                clientSecret: process.env.GRAPH_CLIENT_SECRET,
            },
        };
        const cca = new ConfidentialClientApplication(msalConfig);
        const authResponse = await cca.acquireTokenByClientCredential({
            scopes: ["https://graph.microsoft.com/.default"],
        });

        const client = Client.init({
            authProvider: (done) => done(null, authResponse.accessToken),
        });

        const now = new Date();
        const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthYear = `${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}/${lastMonthDate.getFullYear()}`;

        // Helper para hacer fetch de listas con paginación (para traer TODO de una lista)
        const fetchAllItems = async (listId) => {
            let items = [];
            let url = `/sites/${SITE_ID}/lists/${listId}/items?$expand=fields&$top=999`;
            let response = await client.api(url).header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly').get();
            items = items.concat(response.value);
            
            while (response["@odata.nextLink"]) {
                response = await client.api(response["@odata.nextLink"]).get();
                items = items.concat(response.value);
            }
            return items.map(item => ({ ...item.fields, id: item.id }));
        };

        // Fetch en paralelo de todas las listas
        console.log("Fetching SharePoint data...");
        const results = await Promise.all([
            fetchList(LIST_IDS.notasExpress),
            fetchList(LIST_IDS.tipoFactura),
            fetchList(LIST_IDS.seguros),
            fetchAllItems(LIST_IDS.resumenFactura), // Traemos todas para no errar con filtros históricos
            fetchList(LIST_IDS.tipoStock),
            fetchList(LIST_IDS.turnos)
        ]);
        
        const [allNotas, allTipoFacturas, allSeguros, allResumen, allTipoStock, allTurnos] = results;

        console.log(`Data fetched (Filtered): 
            Notas: ${allNotas.length}
            Tipos: ${allTipoFacturas.length}
            Seguros: ${allSeguros.length}
            Resumen (Filtered): ${allResumen.length}
            Stock: ${allTipoStock.length}
            Turnos: ${allTurnos.length}
        `);

        // ============================================
        // APLICAR LOS "FILTROS" (En JS para el resto de las listas)
        // ============================================

        const notasExpress = allNotas.filter(i => i.Status_NE === "Activo" || i.Status_x0020_NE === "Activo");
        
        const tipoFactura = allTipoFacturas
            .filter(i => i.Status_AT === "Activo" || i.Status_x0020_AT === "Activo")
            .sort((a, b) => (a.Order_AT || 0) - (b.Order_AT || 0));

        const seguros = allSeguros.filter(i => i.Status_AS === "Activo" || i.Status_x0020_AS === "Activo");

        // Resumen Factura: Lógica optimizada
        // - Todas las Pendientes y Vencidas (Historia completa para Ctas Ctes)
        // - Cobradas y Anuladas solo de los últimos 2 meses (Para métricas y movimientos recientes)
        const resumenFactura = allResumen.filter(inv => {
            const status = (inv.Status_RF || inv.Status_x0020_RF || "").trim().toLowerCase();
            const month = (inv.FechaMesAno_RF || "").trim();
            const isHistoricalNeeded = status.includes("pendiente") || status.includes("vencida");
            const isRecentNeeded = (status.includes("cobrada") || status.includes("anulada")) && 
                                 (month === currentMonthYear || month === prevMonthYear);
            
            return isHistoricalNeeded || isRecentNeeded;
        }).sort((a, b) => parseInt(b.id) - parseInt(a.id)); // ID Descending

        const tipoStock = allTipoStock.filter(i => i.Status_ATS === "Activo" || i.Status_x0020_ATS === "Activo");

        // Turnos de hoy: formato "dd/mm/yyyy" - Usamos Fecha_T que es el campo real
        const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const turnos = allTurnos.filter(i => i.Fecha_T === todayStr || i.Fecha_x0020_T === todayStr);

        // Generamos SemanaAux = "yyyy" & WeekNum
        const getWeekNumber = (d) => {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return weekNo;
        }
        const currentYear = now.getFullYear(); // Define currentYear before using it
        const semanaAux = `${currentYear}${getWeekNumber(now)}`;

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
        console.error("Init Data Error:", error);
        return res.status(500).json({ error: "Falló la inicialización de datos", details: error.message });
    }
}
