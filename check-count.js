import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function checkCount() {
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
        console.log("Checking total item count for ResumenFactura...");
        const response = await client.api(`/sites/${SITE_ID}/lists/${LIST_ID}`).get();
        console.log(`Item Count (list metadata): ${response.system?.itemCount || "Unknown"}`);
        
        // Better way to get count
        const items = await client.api(`/sites/${SITE_ID}/lists/${LIST_ID}/items`).get();
        console.log(`Items in first page: ${items.value.length}`);
        if (items["@odata.nextLink"]) {
            console.log("List HAS pagination (more than first page).");
        } else {
            console.log("List does NOT have more than one page.");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

checkCount();
