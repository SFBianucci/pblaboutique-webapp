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

    // Llamamos a nuestro backend (Vercel Serverless Function)
    const response = await fetch('/api/parse-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileBase64: base64Data,
        mimeType: mimeType
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data as ParsedInvoiceData;

  } catch (error: any) {
    console.error("Parse Error:", error);
    throw new Error(error?.message || "Error desconocido al procesar la factura.");
  }
};