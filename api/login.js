import { GoogleGenAI, Type } from "@google/genai";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import jwt from "jsonwebtoken";

// ID de la lista 00Usuarios en SharePoint
const USUARIOS_LIST_ID = "d8eb24e4-ecc8-46eb-8ec5-e3b453ce24c8";

async function getGraphClient() {
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
    authProvider: (done) => {
      done(null, authResponse.accessToken);
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    const SITE_ID = process.env.GRAPH_SITE_ID;

    if (!SITE_ID) {
        console.error("GRAPH_SITE_ID no está configurado.");
        return res.status(500).json({ error: "Error de configuración del servidor." });
    }

    console.log("---- DEBUG LOGIN ----");
    console.log("GRAPH_SITE_ID from env:", SITE_ID);
    console.log("USUARIOS_LIST_ID constant:", USUARIOS_LIST_ID);
    console.log("Username trying to login:", username);

    const client = await getGraphClient();

    // Consultamos la lista de usuarios en SharePoint filtrando por el Username_Usr
    // Usamos el SITE_ID completo con los tres compenentes separados por coma o la ruta sites/id
    const url = `/sites/${SITE_ID}/lists/${USUARIOS_LIST_ID}/items?$expand=fields&$filter=fields/Username_Usr eq '${username.replace(/'/g, "''")}'`;
    
    console.log("Haciendo fetch a graph con url:", url);
    const response = await client.api(url).header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly').get();
    
    const userItems = response.value;

    if (!userItems || userItems.length === 0) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    // Tomamos el primer usuario que coincida
    const userData = userItems[0].fields;

    // Verificamos la contraseña
    if (userData.Password_Usr !== password) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    // Credenciales correctas. Generamos el JWT
    const jwtSecret = process.env.JWT_SECRET || "fallback_secret_for_local_dev_only";
    
    const payload = {
        userId: userItems[0].id,
        username: userData.Username_Usr,
        perfil: userData.Perfil_Usr || 'default', // Agregamos el perfil si existe
        Title: userData.Title || username
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: "24h" });

    // Removemos la contraseña antes de enviar la data del usuario al cliente
    const { Password_Usr, ...safeUserData } = userData;

    return res.status(200).json({ 
        success: true, 
        token, 
        user: { ...payload } 
    });

  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ 
        error: "Error interno del servidor",
        details: error.message 
    });
  }
}
