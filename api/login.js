import jwt from "jsonwebtoken";
import { getGraphClient, getSiteId, getJwtSecret } from "./lib/graph-client.js";
import { LIST_IDS } from "./lib/constants.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    const siteId = getSiteId();
    const client = await getGraphClient();

    // Query SharePoint users list, sanitizing the username for OData filter
    const safeUsername = username.replace(/'/g, "''");
    const url = `/sites/${siteId}/lists/${LIST_IDS.usuarios}/items?$expand=fields&$filter=fields/Username_Usr eq '${safeUsername}'`;

    const response = await client
      .api(url)
      .header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly")
      .get();

    const userItems = response.value;

    if (!userItems || userItems.length === 0) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const userData = userItems[0].fields;

    // TODO: Migrate to hashed passwords — currently plaintext in SharePoint
    if (userData.Password_Usr !== password) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const jwtSecret = getJwtSecret();

    const payload = {
      userId: userItems[0].id,
      username: userData.Username_Usr,
      perfil: userData.Perfil_Usr || "default",
      Title: userData.Title || username,
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: "24h" });

    return res.status(200).json({
      success: true,
      token,
      user: { ...payload },
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
