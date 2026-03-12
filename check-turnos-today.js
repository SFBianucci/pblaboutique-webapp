import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function checkTurnos() {
    const SITE_ID = process.env.GRAPH_SITE_ID;
    const LIST_ID = "968056ca-f6b4-47cc-9cc9-384d76da7c9c"; // 15.Turnos

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
        const now = new Date();
        const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        console.log(`Checking Turnos for today: ${todayStr}`);

        const url = `/sites/${SITE_ID}/lists/${LIST_ID}/items?$expand=fields&$top=999`;
        const response = await client.api(url).get();
        
        const matches = response.value.filter(i => i.fields.Fecha_T === todayStr || i.fields.Fecha_x0020_T === todayStr);
        console.log(`Found ${matches.length} turnos for today.`);
        if (matches.length === 0) {
            console.log("Sample Turno from list:", JSON.stringify(response.value[0]?.fields || {}, null, 2));
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

checkTurnos();
