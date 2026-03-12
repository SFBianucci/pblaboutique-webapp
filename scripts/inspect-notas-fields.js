import dotenv from "dotenv";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

dotenv.config();

async function inspectNotasFields() {
  const siteId = process.env.GRAPH_SITE_ID;
  const listId = "2a449ffb-d7f9-42b3-a2e5-84798b17d3b9";

  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.GRAPH_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}`,
      clientSecret: process.env.GRAPH_CLIENT_SECRET,
    },
  });

  const token = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  const client = Client.init({
    authProvider: (done) => done(null, token.accessToken),
  });

  const response = await client
    .api(`/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=10&$orderby=id desc`)
    .header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly")
    .get();

  console.log("items:", response.value?.length || 0);

  for (const item of response.value || []) {
    console.log("------------------------------");
    console.log("id:", item.id);
    console.log("field keys:", Object.keys(item.fields || {}));
    console.log("fields:", item.fields || {});
  }
}

inspectNotasFields().catch((err) => {
  console.error(err);
  process.exit(1);
});
