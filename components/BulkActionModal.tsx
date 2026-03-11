import React from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { CheckCircle, AlertTriangle, Undo2, X } from 'lucide-react';
import { Invoice } from '../types';
import { cn, formatCurrency } from '../lib/utils';

export type BulkActionType = 'pay' | 'delete' | 'revert' | null;

interface BulkActionModalProps {
    action: BulkActionType;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    selectedInvoices: Invoice[];
}

export const BulkActionModal: React.FC<BulkActionModalProps> = ({ 
    action, 
    onOpenChange, 
    onConfirm, 
    selectedInvoices 
}) => {
    if (!action) return null;

    // Calcular totales internos
    const totalAmount = selectedInvoices.reduce((acc, inv) => acc + inv.amount, 0);
    const count = selectedInvoices.length;

    // Configuración visual según el tipo de acción
    const config = {
        pay: {
            title: "Confirmar Cobro Masivo",
            icon: CheckCircle,
            colorClass: "text-green-600",
            bgClass: "bg-green-50",
            borderClass: "border-green-100",
            btnClass: "bg-[#114a28] hover:bg-[#0d351d]",
            textTitle: "Estás a punto de cobrar facturas",
            textDesc: `Se marcarán como "Cobradas" las siguientes operaciones:`
        },
        delete: {
            title: "Confirmar Anulación",
            icon: AlertTriangle,
            colorClass: "text-red-600",
            bgClass: "bg-red-50",
            borderClass: "border-red-100",
            btnClass: "bg-red-600 hover:bg-red-700",
            textTitle: "Atención: Anulación de comprobantes",
            textDesc: `Vas a anular permanentemente las siguientes operaciones:`
        },
        revert: {
            title: "Revertir Estado",
            icon: Undo2,
            colorClass: "text-orange-600",
            bgClass: "bg-orange-50",
            borderClass: "border-orange-100",
            btnClass: "bg-orange-500 hover:bg-orange-600",
            textTitle: "¿Volver a estado Pendiente?",
            textDesc: `Se restaurarán al estado original las siguientes operaciones:`
        }
    }[action];

    const Icon = config.icon;

    return (
        <Dialog 
            open={!!action} 
            onOpenChange={(open) => !open && onOpenChange(false)}
            title={config.title}
            className="max-w-2xl" // Más ancho para que entre bien la info
        >
            <div className="flex flex-col h-full max-h-[80vh]">
                
                {/* 1. Header Alert */}
                <div className={cn(
                    "mx-6 mt-2 p-4 rounded-lg flex items-start gap-4 border shrink-0",
                    config.bgClass,
                    config.borderClass
                )}>
                    <Icon className={cn("w-6 h-6 shrink-0 mt-0.5", config.colorClass)} />
                    <div>
                        <h4 className={cn("font-bold text-base", config.colorClass.replace('600', '900'))}>
                            {config.textTitle}
                        </h4>
                        <p className={cn("text-sm mt-1 opacity-90", config.colorClass.replace('600', '800'))}>
                            {config.textDesc}
                        </p>
                    </div>
                </div>

                {/* 2. Lista Scrollable (El núcleo del componente) */}
                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 custom-scrollbar">
                    <div className="border rounded-lg border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-semibold text-[10px] uppercase tracking-wider border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Comprobante</th>
                                    <th className="px-4 py-2">Cliente / Seguro</th>
                                    <th className="px-4 py-2 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {selectedInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-2.5 font-mono text-gray-600 text-xs">
                                            <span className="font-bold text-gray-900 block">{inv.invoiceNumber}</span>
                                            {inv.type.replace('Factura ', '')}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="block font-medium text-gray-900 truncate max-w-[200px]">{inv.insurance}</span>
                                            {inv.licensePlate !== '-' && <span className="text-[10px] text-gray-500">{inv.licensePlate}</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums">
                                            {formatCurrency(inv.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Footer Compacto con Totales y Botones */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
                    
                    {/* Stats Compactas */}
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Items</span>
                            <span className="font-bold text-gray-900 text-lg leading-none">{count}</span>
                        </div>
                        <div className="w-px h-8 bg-gray-300"></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Afectado</span>
                            <span className="font-bold text-gray-900 text-lg leading-none tabular-nums tracking-tight">
                                {formatCurrency(totalAmount)}
                            </span>
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)} 
                            className="flex-1 sm:flex-none text-gray-500 hover:text-gray-900"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            className={cn("flex-1 sm:flex-none px-6 font-bold shadow-lg shadow-black/5", config.btnClass)}
                            onClick={onConfirm}
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};