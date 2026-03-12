import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function search2026() {
    const SITE_ID = process.env.GRAPH_SITE_ID;
    const LIST_ID = "e691aa5d-1f3f-4597-a81a-0fb2af9c7fb5"; 

    const cca = new ConfidentialClientApplication({
        auth: {
            clientId: process.env.GRAPH_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}`,
            clientSecret: process.env.GRAPH_CLIENT_SECRET,
        },
    });
    const authResponse = await cca.acquireTokenByClientCredential({
        scopes: ["https://graph.microsoft.com/.default"],
    });
    const client = Client.init({
        authProvider: (done) => done(null, authResponse.accessToken),
    });

    try {
        console.log("Searching for 2026 items only...");
        // Filter directly for 2026 in the API if possible, or just fetch and filter here.
        // To be safe, fetch top 1000 items (which should include 2026 if we sort by ID desc)
        const response = await client.api(`/sites/${SITE_ID}/lists/${LIST_ID}/items?$expand=fields&$top=999&$orderby=id desc`).header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly').get();
        
        const items2026 = response.value.filter(i => (i.fields.FechaMesAno_RF || "").endsWith("/2026"));
        
        const stats = {};
        items2026.forEach(i => {
            const m = i.fields.FechaMesAno_RF;
            const s = (i.fields.Status_RF || i.fields.Status_x0020_RF || "N/A");
            const key = `${m} [${s}]`;
            stats[key] = (stats[key] || 0) + 1;
        });

        console.log("2026 Stats:", JSON.stringify(stats, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

search2026();
