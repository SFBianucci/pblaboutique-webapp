import { GoogleGenAI, Type } from "@google/genai";

export interface ParsedInvoiceData {
  type: string;
  invoiceNumber: string;
  date: string;
  insurance: string;
  description: string;
  licensePlate: string;
  amount: number;
  subtotal: number;
  vat: number;
  cuit: string; 
  siniestro?: string;
  cancelledInvoice?: string;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64String = result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const parseInvoiceDocument = async (file: File): Promise<ParsedInvoiceData | null> => {
  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || "application/pdf";

    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
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
    if (!jsonStr) return null;
    
    const data = JSON.parse(jsonStr) as ParsedInvoiceData;
    return data;

  } catch (error) {
    console.error("Gemini Parse Error:", error);
    return null;
  }
};