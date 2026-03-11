export type View = 'login' | 'dashboard' | 'invoices' | 'inventory' | 'accounts' | 'appointments' | 'reports' | 'stock-reports' | 'abm';

export interface Invoice {
  id: string;
  date: string;           
  insurance: string;      
  invoiceNumber: string;  
  licensePlate: string;   
  type: string;           
  amount: number;         
  status: 'paid' | 'pending' | 'deleted' | 'overdue';
  description: string;    
  siniestro: string;      
  subtotal?: number;
  vat?: number;
  fileName?: string;
  cancelledInvoice?: string;
}

export interface InsuranceSummary {
  name: string;
  cuit: string;
  amount: number;
  count: number;
}

export type StockCategory = 'Parabrisas' | 'Lunetas' | 'Laterales' | 'Escobillas' | 'Burletes' | 'Pegamentos' | 'Otros';

export interface StockItem {
  id: string;
  category: StockCategory;
  brand: string;
  model: string;
  description: string;
  quantity: number;
  minStock: number;
  price?: number;
}

export interface Appointment {
  id: string;
  date: string; 
  time: string;
  client: string;
  car: string;
  phone: string;
  insurance: string;
  job: string;
  status: 'pending' | 'finished';
  details: {
    photo: boolean;
    polarized: boolean;
    engraving: boolean;
  };
}

export interface AccountEntry {
  id: string;
  provider: string;
  balance: number;
  debt: number;
  credit: number;
}