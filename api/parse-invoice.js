import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  // Solo permitimos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileBase64, mimeType } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: 'Falta el archivo base64' });
    }

    // Leemos la API key desde el entorno seguro del servidor (Vercel Node.js)
    // NOTA: Acá se llama GEMINI_API_KEY, no hace falta el VITE_
    const apiKey = process.env.GEMINI_API_KEY; 
    
    if (!apiKey) {
      console.error("API Key no configurada en el servidor.");
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType || "application/pdf",
            },
          },
          {
            text: `Extract the following invoice details from this document.
            If a field is not found, return an empty string or 0 for numbers.
            
            Fields to extract:
            - type: The invoice type (e.g., "Factura A", "Factura B", "Nota de Credito - Factura A", "MiPyme", etc.).
            - invoiceNumber: The invoice number, usually in format XXXX-XXXXXXXX.
            - date: The issue date in YYYY-MM-DD format.
            - insurance: The name of the client or insurance company (Aseguradora).
            - description: A short description of the service (e.g., "Cambio Parabrisas").
            - licensePlate: The vehicle license plate (Patente) if present.
            - amount: The total amount (Importe Total) as a number.
            - subtotal: The net taxed amount (Neto Gravado) as a number.
            - vat: The VAT amount (IVA 21%) as a number.
            - cuit: The CUIT of the client/insurance company.
            - siniestro: The claim number (N° Siniestro) if present.
            - cancelledInvoice: If this is a Credit Note (Nota de Credito), the number of the invoice it cancels (Comprobante Asociado/Cancelado).`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: "Invoice type" },
            invoiceNumber: { type: Type.STRING, description: "Invoice number (XXXX-XXXXXXXX)" },
            date: { type: Type.STRING, description: "Issue date (YYYY-MM-DD)" },
            insurance: { type: Type.STRING, description: "Client or Insurance company name" },
            description: { type: Type.STRING, description: "Service description" },
            licensePlate: { type: Type.STRING, description: "Vehicle license plate" },
            amount: { type: Type.NUMBER, description: "Total amount" },
            subtotal: { type: Type.NUMBER, description: "Net taxed amount (Subtotal)" },
            vat: { type: Type.NUMBER, description: "VAT amount" },
            cuit: { type: Type.STRING, description: "Client CUIT" },
            siniestro: { type: Type.STRING, description: "Claim number (Siniestro)" },
            cancelledInvoice: { type: Type.STRING, description: "Cancelled invoice number (for credit notes)" }
          },
          required: ["type", "invoiceNumber", "date", "insurance", "description", "licensePlate", "amount", "subtotal", "vat", "cuit", "siniestro"]
        }
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("La IA no devolvió ningún dato.");
    
    // Attempt to extract JSON if it was wrapped in markdown blocks
    let cleanJsonStr = jsonStr;
    if (jsonStr.startsWith("\`\`\`json")) {
        cleanJsonStr = jsonStr.replace(/^\`\`\`json\s*/, '').replace(/\s*\`\`\`$/, '');
    } else if (jsonStr.startsWith("\`\`\`")) {
        cleanJsonStr = jsonStr.replace(/^\`\`\`\s*/, '').replace(/\s*\`\`\`$/, '');
    }

    const data = JSON.parse(cleanJsonStr);
    return res.status(200).json(data);

  } catch (error) {
    console.error("Gemini Parse Error:", error);
    return res.status(500).json({ error: error?.message || "Error desconocido al conectar con la IA." });
  }
}
