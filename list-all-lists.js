import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

async function listAllLists() {
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
        console.log("Listing all lists in the site...");
        const response = await client.api(`/sites/${SITE_ID}/lists`).get();
        
        response.value.forEach(list => {
            console.log(`Name: ${list.displayName}, ID: ${list.id}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

listAllLists();
