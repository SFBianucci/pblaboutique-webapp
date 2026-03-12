import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function findRelevantLists() {
    const SITE_ID = process.env.GRAPH_SITE_ID;

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
        console.log("Searching for lists with 'Resumen' or 'Factura' in name...");
        const response = await client.api(`/sites/${SITE_ID}/lists`).get();
        
        const relevant = response.value.filter(list => 
            list.displayName.toLowerCase().includes("resumen") || 
            list.displayName.toLowerCase().includes("factura")
        );

        relevant.forEach(list => {
            console.log(`[FOUND] Name: ${list.displayName}, ID: ${list.id}`);
        });

        if (relevant.length === 0) {
            console.log("No relevant lists found by name. All lists are:");
            response.value.forEach(list => {
                console.log(`- ${list.displayName} (${list.id})`);
            });
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

findRelevantLists();
