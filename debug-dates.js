import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function checkDates() {
    const SITE_ID = process.env.GRAPH_SITE_ID;
    const LIST_ID = "e691aa5d-1f3f-4597-a81a-0fb2af9c7fb5"; // 01.ResumenFactura

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
        console.log("Fetching sample data from ResumenFactura...");
        const url = `/sites/${SITE_ID}/lists/${LIST_ID}/items?$expand=fields&$top=5`;
        const response = await client.api(url).get();
        
        response.value.forEach((item, idx) => {
            console.log(`Item ${idx + 1} fields:`, JSON.stringify(item.fields, null, 2));
        });

        const now = new Date();
        const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        console.log("Our currentMonthYear string:", `'${currentMonthYear}'`);

    } catch (error) {
        console.error("Error checking dates:", error);
    }
}

checkDates();
