import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

/**
 * Creates an authenticated Microsoft Graph client using app-only (client credentials) flow.
 * Reuses MSAL config from environment variables.
 */
export async function getGraphClient() {
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

  return Client.init({
    authProvider: (done) => done(null, authResponse.accessToken),
  });
}

/**
 * Returns the GRAPH_SITE_ID from env or throws a clear error.
 */
export function getSiteId() {
  const siteId = process.env.GRAPH_SITE_ID;
  if (!siteId) {
    throw new Error("GRAPH_SITE_ID no está configurado en las variables de entorno.");
  }
  return siteId;
}

/**
 * Returns the JWT_SECRET from env. Throws if not configured in production.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no está configurado en las variables de entorno.");
  }
  return secret;
}

/**
 * Fetches all items from a SharePoint list with pagination support.
 */
export async function fetchAllListItems(client, siteId, listId) {
  let items = [];
  let url = `/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=999`;
  let response = await client
    .api(url)
    .header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly")
    .get();
  items = items.concat(response.value);

  while (response["@odata.nextLink"]) {
    response = await client.api(response["@odata.nextLink"]).get();
    items = items.concat(response.value);
  }

  return items.map((item) => ({ ...item.fields, id: item.id }));
}
