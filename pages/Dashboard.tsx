import React, { useState } from 'react';
import { RefreshCw, Plus, DollarSign, ArrowUpRight, ArrowRight, MoreHorizontal, CalendarClock, CreditCard, AlertCircle, Package } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { InsuranceSummary, Invoice } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { useAppData } from '../lib/AppDataContext';

interface DashboardProps {
    onNavigateToInvoice: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToInvoice }) => {
  const { appData } = useAppData();
  const [activeTab, setActiveTab] = useState<'pending' | 'paid' | 'overdue'>('pending');

  if (!appData) return null;

  const { resumenFactura, turnos } = appData;

  // 1. Cálculos de Facturación
  // Sumamos todas las "Cobradas" que trajo el servidor (que ya vienen filtradas por los últimos 2 meses)
  const facturasCobradas = resumenFactura.filter(inv => {
    const status = (inv.Status_RF || inv.Status_x0020_RF || '').trim().toLowerCase();
    return status === 'cobrada';
  });
  const facturacionMesTotal = facturasCobradas.reduce((acc, inv) => acc + (Number(inv.Total_RF) || 0), 0);

  const facturasPendientes = resumenFactura.filter(inv => {
    const status = (inv.Status_RF || inv.Status_x0020_RF || '').trim().toLowerCase();
    return status === 'pendiente';
  });
  const aCobrarTotal = facturasPendientes.reduce((acc, inv) => acc + (Number(inv.Total_RF) || 0), 0);

  const facturasVencidas = resumenFactura.filter(inv => {
    const status = (inv.Status_RF || inv.Status_x0020_RF || '').trim().toLowerCase();
    return status === 'vencida';
  });
  const vencidasTotal = facturasVencidas.reduce((acc, inv) => acc + (Number(inv.Total_RF) || 0), 0);

  // 2. Ranking de Seguros (Agrupado por Seguro_RF)
  const rankingMap = resumenFactura.reduce((acc: any, inv) => {
    const insurance = inv.Seguro_RF || 'S/D';
    if (!acc[insurance]) {
      acc[insurance] = { name: insurance, amount: 0, count: 0 };
    }
    acc[insurance].amount += (Number(inv.Total_RF) || 0);
    acc[insurance].count += 1;
    return acc;
  }, {});

  const insurances: InsuranceSummary[] = Object.values(rankingMap)
    .sort((a: any, b: any) => b.amount - a.amount) as InsuranceSummary[];

  // 3. Mapeo de Movimientos Recientes
  const recentInvoices: Invoice[] = resumenFactura.map((inv: any) => {
    const status = (inv.Status_RF || inv.Status_x0020_RF || '').toLowerCase();
    return {
      id: inv.id,
      date: inv.Fecha_RF,
      insurance: inv.Seguro_RF || 'S/D',
      invoiceNumber: String(inv.NroFactura_RF || ''),
      licensePlate: inv.Patente_RF || '',
      amount: Number(inv.Total_RF) || 0,
      status: status === 'cobrada' ? 'paid' : 
              status === 'anulada' ? 'overdue' : // Usamos el rojo de vencida o similar
              status === 'vencida' ? 'overdue' : 'pending',
      type: inv.TipoFactura_RF || 'Factura',
      description: inv.Servicio_RF || '',
      siniestro: inv.Siniestro_RF || ''
    };
  });

  const filteredInvoices = recentInvoices.filter(inv => {
      if (activeTab === 'paid') return inv.status === 'paid';
      if (activeTab === 'pending') return inv.status === 'pending';
      if (activeTab === 'overdue') return inv.status === 'overdue';
      return false; 
  });

  // 4. Turnos de hoy
  const turnosHoyCount = turnos.length;
  const turnosTerminados = turnos.filter((t: any) => t.Status_T === 'Entregado' || t.Status_T === 'Terminado').length;
  const turnosPendientes = turnosHoyCount - turnosTerminados;

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

      {/* 2. KPI Cards - COMPACT ROW (3 Columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Facturación */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col gap-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Facturación Mes</span>
                    <DollarSign className="h-4 w-4 text-gray-400" />
                </div>
                <span className="text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(facturacionMesTotal)}</span>
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
                <span className="text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(aCobrarTotal)}</span>
                <span className="text-[10px] font-medium text-orange-600 flex items-center bg-orange-50 w-fit px-1.5 rounded-sm">
                     {formatCurrency(vencidasTotal)} vencidas
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
                    <span className="text-2xl font-bold text-gray-900 tracking-tight">{turnosHoyCount}</span>
                    <span className="text-xs text-gray-500 mb-1 font-medium">{turnosHoyCount === 1 ? 'auto' : 'autos'}</span>
                </div>
                <span className="text-[10px] font-medium text-green-700 flex items-center">
                    {turnosTerminados} terminados • {turnosPendientes} pendientes
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
                        {filteredInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-xs italic">
                                    No hay registros que mostrar.
                                </td>
                            </tr>
                        ) : filteredInvoices.slice(0, 8).map((inv, idx) => (
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
                                        {inv.status === 'paid' ? 'Cobrada' : 
                                         inv.status === 'overdue' && (resumenFactura.find(r => r.id === inv.id)?.Status_RF || '').toLowerCase().includes('anulada') ? 'Anulada' :
                                         inv.status === 'overdue' ? 'Vencida' : 'Pendiente'}
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
              <div className="px-5 py-3 border-b border-gray-100 flex flex-col gap-0.5 bg-gray-50/30">
                 <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Ranking</h3>
                    <span className="text-[10px] text-gray-400 font-mono">{new Date().getFullYear()}</span>
                 </div>
                 <p className="text-[9px] text-gray-400 italic">Basado solo en facturas cobradas</p>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[600px] p-2 space-y-1 custom-scrollbar">
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