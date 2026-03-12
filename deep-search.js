import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function deepSearch() {
    const SITE_ID = process.env.GRAPH_SITE_ID;
    const LIST_ID = "e691aa5d-1f3f-4597-a81a-0fb2af9c7fb5"; 

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

    try {
        console.log("Searching for ANY item with FechaMesAno_RF starting with 2026 or 2025...");
        
        // Let's try to find if there is ANY item from 2026
        // We'll fetch more items, say 3000, by following nextLinks
        let items = [];
        let url = `/sites/${SITE_ID}/lists/${LIST_ID}/items?$expand=fields&$top=999`;
        
        console.log("Fetching first page...");
        let response = await client.api(url).header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly').get();
        items = items.concat(response.value);
        
        while (response["@odata.nextLink"] && items.length < 5000) {
            console.log(`Fetching next page... Current count: ${items.length}`);
            response = await client.api(response["@odata.nextLink"]).get();
            items = items.concat(response.value);
        }

        console.log(`Total items fetched for analysis: ${items.length}`);
        
        const distribution = {};
        items.forEach(item => {
            const date = item.fields.FechaMesAno_RF;
            const status = (item.fields.Status_RF || item.fields.Status_x0020_RF || "N/A");
            const key = `${date} [${status}]`;
            distribution[key] = (distribution[key] || 0) + 1;
        });

        console.log("Detailed Distribution (Month [Status]):", JSON.stringify(distribution, null, 2));

        const now = new Date();
        const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        console.log(`Current Month (${currentMonthYear}) items:`, items.filter(i => i.fields.FechaMesAno_RF === currentMonthYear).map(i => ({ id: i.id, status: i.fields.Status_RF || i.fields.Status_x0020_RF, total: i.fields.Total_RF })));

    } catch (error) {
        console.error("Error:", error);
    }
}

deepSearch();
