import React, { useState } from 'react';
import { RefreshCw, Plus, DollarSign, ArrowUpRight, ArrowRight, MoreHorizontal, CalendarClock, CreditCard, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { InsuranceSummary, Invoice } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface DashboardProps {
    onNavigateToInvoice: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToInvoice }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'paid' | 'overdue'>('pending');

  const insurances: InsuranceSummary[] = [
    { name: "ARMORAUT", cuit: "30-50003721-7", amount: 12450000.00, count: 42 },
    { name: "ALLIANZ", cuit: "30-50003721-7", amount: 7431000.00, count: 11 },
    { name: "CAJA SEGUROS", cuit: "30-50003721-7", amount: 4866474.49, count: 17 },
    { name: "DIETRICH", cuit: "30-50003721-7", amount: 3506250.00, count: 19 },
    { name: "ATM SEGUROS", cuit: "30-50003721-7", amount: 1448975.00, count: 6 },
  ];

  // Datos normalizados según types.ts actualizado
  const recentInvoices: Invoice[] = [
    { id: "3091", date: "30/01/2026", insurance: "ARMORAUT", invoiceNumber: "10524", licensePlate: "AG383VQ", amount: 151250.00, status: "pending", type: "Factura A", description: "COLOC KUGA", siniestro: "518132" },
    { id: "3082", date: "28/01/2026", insurance: "ARMORAUT", invoiceNumber: "10513", licensePlate: "AH358RH", amount: 151250.00, status: "pending", type: "Factura A", description: "COLOC BRONCO", siniestro: "518509" },
    { id: "3081", date: "28/01/2026", insurance: "ARMORAUT", invoiceNumber: "10514", licensePlate: "AH016YV", amount: 151250.00, status: "pending", type: "Factura A", description: "COLOC RANGER", siniestro: "518529" },
    { id: "3080", date: "28/01/2026", insurance: "ARMORAUT", invoiceNumber: "10515", licensePlate: "AG390UQ", amount: 151250.00, status: "pending", type: "Factura A", description: "COLOC MAVERICK", siniestro: "518533" },
    { id: "3043", date: "23/01/2026", insurance: "ARMORAUT", invoiceNumber: "10476", licensePlate: "AC574JX", amount: 90750.00, status: "pending", type: "Factura A", description: "CDIA ECO", siniestro: "1521" },
    { id: "2854", date: "17/12/2025", insurance: "ARMORAUT", invoiceNumber: "10286", licensePlate: "AH469QJ", amount: 145200.00, status: "paid", type: "Factura A", description: "COLOC", siniestro: "517452" },
    { id: "2848", date: "17/12/2025", insurance: "ARMORAUT", invoiceNumber: "10282", licensePlate: "AF785CF", amount: 620000.00, status: "paid", type: "Factura A", description: "PSAS TERRITORY", siniestro: "517290" },
    { id: "2845", date: "17/12/2025", insurance: "ARMORAUT", invoiceNumber: "10283", licensePlate: "THF22492", amount: 800000.00, status: "pending", type: "Factura A", description: "PSAS TERRITORY", siniestro: "okm" },
    { id: "2718", date: "28/11/2025", insurance: "ARMORAUT", invoiceNumber: "10170", licensePlate: "FIESTA", amount: 157300.00, status: "paid", type: "Factura A", description: "COLOC LTA LAVALE", siniestro: "310046" },
    { id: "2561", date: "31/10/2025", insurance: "ARMORAUT", invoiceNumber: "10028", licensePlate: "AG336KY", amount: 145000.00, status: "paid", type: "Factura A", description: "PSAS FORD BRONCO", siniestro: "516635" },
  ];

  const filteredInvoices = recentInvoices.filter(inv => {
      if (activeTab === 'paid') return inv.status === 'paid';
      if (activeTab === 'pending') return inv.status === 'pending';
      if (activeTab === 'overdue') return inv.status === 'overdue';
      return false; 
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. Header with clear hierarchy (Compact) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Panel de Control</h1>
            <p className="text-gray-500 text-sm">Resumen de hoy, <span className="font-medium text-gray-700">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white border-gray-200 text-gray-600 h-9 px-3 text-xs font-medium shadow-sm">
                <RefreshCw className="w-3.5 h-3.5 mr-2" /> Actualizar
            </Button>
            <Button className="bg-[#0a1f11] hover:bg-[#143d21] text-white h-9 px-4 text-xs font-bold rounded-lg shadow-sm">
                <Plus className="w-3.5 h-3.5 mr-2" /> Nueva Operación
            </Button>
          </div>
      </div>

      {/* 2. KPI Cards - COMPACT ROW (4 Columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Facturación */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col gap-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Facturación Mes</span>
                    <DollarSign className="h-4 w-4 text-gray-400" />
                </div>
                <span className="text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(18950200)}</span>
                <span className="text-[10px] font-medium text-green-600 flex items-center bg-green-50 w-fit px-1.5 rounded-sm">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" /> +12.5%
                </span>
            </CardContent>
        </Card>

        {/* Card 2: Pendiente */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col gap-1">
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">A Cobrar</span>
                    <AlertCircle className="h-4 w-4 text-orange-400" />
                </div>
                <span className="text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(2450000)}</span>
                <span className="text-[10px] font-medium text-orange-600 flex items-center bg-orange-50 w-fit px-1.5 rounded-sm">
                     8 vencidas
                </span>
            </CardContent>
        </Card>

        {/* Card 3: Caja Diaria */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col gap-1">
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Caja Hoy</span>
                    <CreditCard className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(125000)}</span>
                <span className="text-[10px] font-medium text-gray-400 flex items-center">
                    Último cierre: 18:00hs
                </span>
            </CardContent>
        </Card>

        {/* Card 4: Turnos */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-all bg-green-50/30 border-green-100">
            <CardContent className="p-4 flex flex-col gap-1">
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Turnos Hoy</span>
                    <CalendarClock className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-gray-900 tracking-tight">5</span>
                    <span className="text-xs text-gray-500 mb-1 font-medium">autos</span>
                </div>
                <span className="text-[10px] font-medium text-green-700 flex items-center">
                    2 terminados • 3 pendientes
                </span>
            </CardContent>
        </Card>
      </div>

      {/* 3. Main Content - Clean Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Column: Recent Invoices Table (Expanded Width) */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="px-5 py-3 border-b border-gray-100 flex flex-row items-center justify-between bg-white">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Últimos Movimientos</h3>
                
                {/* Micro Tabs */}
                <div className="flex p-0.5 bg-gray-100/80 rounded-md">
                    {['pending', 'paid', 'overdue'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={cn(
                                "px-3 py-1 text-[10px] font-bold rounded-sm transition-all capitalize", 
                                activeTab === tab 
                                    ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            {tab === 'pending' ? 'Pendientes' : tab === 'paid' ? 'Cobradas' : 'Vencidas'}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/50 text-gray-500 font-semibold text-[10px] uppercase tracking-wider border-b border-gray-100">
                        <tr>
                            <th className="px-5 py-3 w-28">Fecha</th>
                            <th className="px-5 py-3">Vehículo / Descripción</th>
                            <th className="px-5 py-3 hidden sm:table-cell">Seguro</th>
                            <th className="px-5 py-3 text-right">Monto</th>
                            <th className="px-5 py-3 text-center w-28">Estado</th>
                            <th className="px-2 py-3 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredInvoices.slice(0, 8).map((inv, idx) => (
                            <tr 
                                key={idx} 
                                onClick={() => onNavigateToInvoice(inv.id)}
                                className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                            >
                                <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs font-medium font-mono">{inv.date}</td>
                                <td className="px-5 py-3">
                                    <div className="font-bold text-gray-900 text-xs flex items-center gap-2">
                                        {inv.licensePlate} 
                                        {inv.description && <span className="text-gray-400 font-normal border-l pl-2 border-gray-300 truncate max-w-[150px]">{inv.description}</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                        {inv.type} • N° {inv.invoiceNumber}
                                    </div>
                                </td>
                                <td className="px-5 py-3 hidden sm:table-cell">
                                    <Badge variant="outline" className="text-[10px] font-medium text-gray-600 bg-white border-gray-200 px-1.5 py-0 h-5">
                                        {inv.insurance}
                                    </Badge>
                                </td>
                                <td className="px-5 py-3 text-right font-bold text-gray-900 text-xs tabular-nums">
                                    {formatCurrency(inv.amount)}
                                </td>
                                <td className="px-5 py-3 text-center">
                                    <span className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border",
                                        inv.status === 'paid' 
                                            ? "bg-green-50 text-green-700 border-green-100" 
                                            : "bg-orange-50 text-orange-700 border-orange-100"
                                    )}>
                                        {inv.status === 'paid' ? 'Cobrada' : 'Pendiente'}
                                    </span>
                                </td>
                                <td className="px-2 py-3 text-center">
                                    <button className="text-gray-300 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors">
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="p-2 border-t border-gray-100 bg-gray-50/30 flex justify-center">
                <Button variant="ghost" size="sm" className="text-[10px] h-7 text-gray-500 hover:text-gray-900">
                    Ver todas las operaciones <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Insurance Summary */}
        <div className="xl:col-span-1">
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                 <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Ranking</h3>
                 <span className="text-[10px] text-gray-400 font-mono">{new Date().getFullYear()}</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[500px] p-2 space-y-1 custom-scrollbar">
                  {insurances.map((ins, idx) => (
                      <div key={idx} className="p-2.5 rounded hover:bg-gray-50 transition-colors cursor-default group border border-transparent hover:border-gray-100">
                          <div className="flex justify-between items-center mb-1.5">
                              <span className="font-bold text-xs text-gray-800 truncate">{ins.name}</span>
                              <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {ins.count}
                              </span>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gray-800 rounded-full group-hover:bg-green-600 transition-colors duration-500" 
                                    style={{ width: `${Math.min((ins.amount / 12000000) * 100, 100)}%` }}
                                  ></div>
                            </div>
                            <div className="flex justify-end">
                                <span className="text-[10px] font-bold text-gray-600 tabular-nums">
                                    {formatCurrency(ins.amount)}
                                </span>
                            </div>
                          </div>
                      </div>
                  ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};