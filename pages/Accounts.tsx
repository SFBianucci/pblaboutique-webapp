import React from 'react';
import { 
  RefreshCw, Plus, FileSpreadsheet, Search
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatCurrency } from '../lib/utils';

export const Accounts: React.FC = () => {
  const accounts = [
    { provider: "ALRA", balance: 2486312.20, debt: 16080469.41, credit: -13594157.21 },
    { provider: "AUTONOVO", balance: 1028603.13, debt: 2431189.87, credit: -1402586.74 },
    { provider: "CHAPA MERCEDES", balance: 8956951.42, debt: 109671811.85, credit: -100714860.43 },
    { provider: "DARC", balance: 2525196.01, debt: 11612221.70, credit: -9087025.69 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-2 rounded-lg border shadow-sm">
        <h2 className="text-xl font-bold text-gray-700 ml-2">Cuenta Corriente</h2>
        
        <div className="flex items-center space-x-2">
           <Button variant="outline" className="text-gray-600 border-gray-300 bg-white">
             <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
           </Button>
           <Button variant="outline" className="text-gray-600 border-gray-300 bg-white">
             Ingresar Pago <Plus className="w-4 h-4 ml-2" />
           </Button>
           <Button className="bg-[#114a28] hover:bg-[#0e3b20]">
             Ingresar Factura <Plus className="w-4 h-4 ml-2" />
           </Button>
           <div className="relative">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
             <Input placeholder="Buscar" className="pl-9 w-48 bg-white" />
           </div>
           <Button variant="outline" className="bg-white text-gray-600 border-gray-300">
             <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
           </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#114a28] text-white">
            <tr>
              <th className="py-3 px-4 text-left">Proveedor ↕</th>
              <th className="py-3 px-4 text-left">Saldo</th>
              <th className="py-3 px-4 text-left">Deuda</th>
              <th className="py-3 px-4 text-left">Haber</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-bold text-gray-700">{acc.provider}</td>
                <td className="py-3 px-4 font-semibold">{formatCurrency(acc.balance)}</td>
                <td className="py-3 px-4 font-semibold text-red-600">{formatCurrency(acc.debt)}</td>
                <td className="py-3 px-4 font-semibold text-blue-600">{formatCurrency(acc.credit)}</td>
                <td className="py-3 px-4 text-center">
                    <button className="text-gray-500 hover:text-black rounded-full border border-gray-400 p-1"><RefreshCw className="w-3 h-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};