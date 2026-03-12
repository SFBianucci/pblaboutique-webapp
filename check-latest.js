import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function checkLatest() {
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
        console.log("Fetching the ABSOLUTE LATEST item...");
        const url = `/sites/${SITE_ID}/lists/${LIST_ID}/items?$expand=fields&$top=1&$orderby=id desc`;
        const response = await client.api(url).header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly').get();
        
        console.log("Latest Item Fields:", JSON.stringify(response.value[0]?.fields || "EMPTY", null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

checkLatest();
