import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import "dotenv/config";
import fs from "fs";

// --- VERIFICAR Y REEMPLAZAR SI ES NECESARIO ---
// El nombre de tu sitio de SharePoint suele estar en la URL. 
// Ejemplo: si tu url es https://plaboutique.sharepoint.com/sites/Facturacion
// El hostname es: plaboutique.sharepoint.com
// El sitePath es: /sites/Facturacion
const SHAREPOINT_HOSTNAME = "plaboutique.sharepoint.com";
const SHAREPOINT_SITEPATH = "/sites/Parabrisas"; // <- Cambiá esto por el nombre de tu sitio si es otro

async function getSharePointIds() {
    console.log("Iniciando conexión con Microsoft Graph...");

    const msalConfig = {
        auth: {
            clientId: process.env.GRAPH_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}`,
            clientSecret: process.env.GRAPH_CLIENT_SECRET,
        }
    };

    const cca = new ConfidentialClientApplication(msalConfig);

    try {
        const authResponse = await cca.acquireTokenByClientCredential({
            scopes: ["https://graph.microsoft.com/.default"],
        });

        const client = Client.init({
            authProvider: (done) => {
                done(null, authResponse.accessToken);
            }
        });

        console.log(`\n1. Buscando el ID del sitio en: ${SHAREPOINT_HOSTNAME}${SHAREPOINT_SITEPATH} ...`);

        // Obtener Site ID
        const site = await client.api(`/sites/${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITEPATH}`).get();
        console.log("✅ SITE ENCONTRADO!");
        console.log("--------------------------------------------------");
        console.log(`👉 Tu GRAPH_SITE_ID es: ${site.id}`);
        console.log("--------------------------------------------------\n");

        console.log("2. Buscando las listas adentro de ese sitio...");
        // Obtener Listas del sitio
        const lists = await client.api(`/sites/${site.id}/lists`).get();

        console.log("✅ LISTAS ENCONTRADAS:");
        let constantsContent = "export const SHAREPOINT_LISTS = {\n";
        lists.value.forEach(list => {
            // Filtramos las listas de sistema ocultas para que sea más fácil leer
            if (!list.name.startsWith("App") && !list.name.startsWith("Taxonomy") && !list.name.startsWith("Composed")) {
                const safeName = list.displayName.replace(/[^a-zA-Z0-9_]/g, '');
                constantsContent += `  ${safeName}: "${list.id}",\n`;
                console.log(`- Procesada la lista: "${list.displayName}"`);
            }
        });
        constantsContent += "};\n";

        fs.writeFileSync("./lib/constants.ts", constantsContent, "utf8");
        console.log("--------------------------------------------------");
        console.log("🎉 ¡ÉXITO! Se autogeneró el archivo lib/constants.ts con todos los IDs de tus listas.");
        console.log("Asegurate de poner el GRAPH_SITE_ID en tu archivo .env");

    } catch (error) {
        console.error("\n❌ ERROR AL CONECTAR - Revisa los mensajes abajo:");
        if (error.statusCode === 401 || error.statusCode === 403) {
            console.error("- Parece un error de permisos. ¿Le diste 'Grant admin consent' al permiso Sites.ReadWrite.All en Entra ID?");
        }
        console.error(error.message);
    }
}

getSharePointIds();
