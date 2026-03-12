import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function checkDateDistribution() {
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
        console.log("Fetching LATEST 999 items to check date distribution...");
        const url = `/sites/${SITE_ID}/lists/${LIST_ID}/items?$expand=fields&$top=999&$orderby=id desc`;
        const response = await client.api(url).header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly').get();
        
        const dates = response.value.map(item => item.fields.FechaMesAno_RF);
        const distribution = {};
        dates.forEach(d => {
            distribution[d] = (distribution[d] || 0) + 1;
        });

        console.log("Latest 999 Items - Date Distribution:", JSON.stringify(distribution, null, 2));
        
        const now = new Date();
        const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthYear = `${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}/${lastMonthDate.getFullYear()}`;
        
        console.log(`Current: ${currentMonthYear}, Prev: ${prevMonthYear}`);
        console.log(`Found current? ${!!distribution[currentMonthYear]}`);
        console.log(`Found prev? ${!!distribution[prevMonthYear]}`);

    } catch (error) {
        console.error("Error:", error);
    }
}

checkDateDistribution();
