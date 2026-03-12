import dotenv from "dotenv";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

dotenv.config();

async function inspectFFSFields() {
  const siteId = process.env.GRAPH_SITE_ID;
  const listId = "e62e3e4d-9d34-48bd-a6e3-423c7c327bc0";

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
    .api(`/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=5&$orderby=id desc`)
    .header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly")
    .get();

  console.log("items:", response.value?.length || 0);
  for (const item of response.value || []) {
    console.log("id:", item.id);
    console.log("field keys:", Object.keys(item.fields || {}));
    console.log({
      idFactura: item.fields?.IDFactura_FFS,
      documento: item.fields?.DocumentoFactura_FFS,
      pdfType: typeof item.fields?.PDFFactura_FFS,
      pdfLength: (item.fields?.PDFFactura_FFS || "").length,
    });
  }
}

inspectFFSFields().catch((err) => {
  console.error(err);
  process.exit(1);
});
