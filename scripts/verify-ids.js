import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import dotenv from "dotenv";

dotenv.config();

const IDs_TO_CHECK = [
    "2a449ffb-d7f9-42b3-a2e5-84798b17d3b9",
    "e7b853f1-3aaa-4940-899a-ced8244318b2",
    "a9906d50-6ab2-4228-97f9-3d0367544a37",
    "e691aa5d-1f3f-4597-a81a-0fb2af9c7fb5",
    "f6f9feb4-422f-4c1f-abd3-357d3fd5d57e",
    "968056ca-f6b4-47cc-9cc9-384d76da7c9c"
];

async function verifyIDs() {
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
        console.log("Verifying current List IDs...");
        for (const id of IDs_TO_CHECK) {
            try {
                const list = await client.api(`/sites/${SITE_ID}/lists/${id}`).get();
                console.log(`[OK] ID: ${id} -> Name: ${list.displayName}`);
            } catch (e) {
                console.log(`[ERROR] ID: ${id} -> Not found or No access`);
            }
        }

    } catch (error) {
        console.error("Critical Error:", error);
    }
}

verifyIDs();
