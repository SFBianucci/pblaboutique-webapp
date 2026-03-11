import React from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { CheckCircle, Printer, Download, Undo2, Trash2, FileText } from 'lucide-react';
import { Invoice } from '../types';
import { formatCurrency } from '../lib/utils';

interface InvoiceDetailModalProps {
    invoice: Invoice | null;
    onClose: () => void;
    onStatusChange: (id: string, newStatus: Invoice['status']) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, onClose, onStatusChange }) => {
    if (!invoice) return null;

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'paid': return <Badge variant="success" className="bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 px-3 py-1 text-xs">Cobrada</Badge>;
            case 'pending': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200 px-3 py-1 text-xs">Pendiente</Badge>;
            case 'overdue': return <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 px-3 py-1 text-xs">Vencida</Badge>;
            case 'deleted': return <Badge variant="outline" className="text-gray-400 border-gray-200 bg-gray-50 px-3 py-1 text-xs">Anulada</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <Dialog 
            open={!!invoice} 
            onOpenChange={(open) => !open && onClose()} 
            title="Detalle de Operación"
        >
            <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                        <h3 className="font-bold text-xl text-gray-900">{invoice.insurance}</h3>
                        <p className="text-sm text-gray-500 font-mono mt-1">{invoice.type} N° {invoice.invoiceNumber}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(invoice.status)}
                        <span className="text-xs text-gray-400">{invoice.date}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 px-2">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Vehículo</label>
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 border border-gray-200">
                                {invoice.licensePlate !== '-' ? invoice.licensePlate.slice(0,2) : '-'}
                            </div>
                            <span className="font-mono font-bold text-lg">{invoice.licensePlate}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Siniestro / Ref</label>
                        <span className="text-sm font-medium text-gray-700 block mt-2">{invoice.siniestro || 'Sin referencia'}</span>
                    </div>
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descripción</label>
                        <p className="text-sm text-gray-800 font-medium bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                            {invoice.description || 'Sin descripción detallada.'}
                        </p>
                    </div>
                    {invoice.cancelledInvoice && (
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Comprobante Cancelado</label>
                            <p className="text-sm text-gray-800 font-medium bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                                {invoice.cancelledInvoice}
                            </p>
                        </div>
                    )}
                    {invoice.fileName && (
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Archivo Adjunto</label>
                            <p className="text-sm text-gray-800 font-medium bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-500" />
                                {invoice.fileName}
                            </p>
                        </div>
                    )}
                </div>

                <div className="border-t border-dashed border-gray-200 pt-4 px-2 space-y-2">
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>Neto Gravado</span>
                        <span className="font-mono">{formatCurrency(invoice.type.includes('Exenta') ? invoice.amount : invoice.amount / 1.21)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>IVA (21%)</span>
                        <span className="font-mono">{formatCurrency(invoice.type.includes('Exenta') ? 0 : invoice.amount - (invoice.amount / 1.21))}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold text-gray-900 pt-2">
                        <span>Total</span>
                        <span className="text-2xl">{formatCurrency(invoice.amount)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    {invoice.status === 'pending' && (
                        <Button 
                            className="col-span-2 bg-green-600 hover:bg-green-700 h-12 text-base shadow-lg shadow-green-900/20"
                            onClick={() => onStatusChange(invoice.id, 'paid')}
                        >
                            <CheckCircle className="w-5 h-5 mr-2" /> Marcar como Cobrada
                        </Button>
                    )}
                    <Button variant="outline" className="h-10 border-gray-300 text-gray-600">
                        <Printer className="w-4 h-4 mr-2" /> Imprimir
                    </Button>
                    <Button variant="outline" className="h-10 border-gray-300 text-gray-600">
                        <Download className="w-4 h-4 mr-2" /> PDF
                    </Button>
                    {(invoice.status === 'paid' || invoice.status === 'deleted') && (
                        <Button 
                            variant="outline"
                            className="col-span-2 h-10 border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100"
                            onClick={() => onStatusChange(invoice.id, 'pending')}
                        >
                            <Undo2 className="w-4 h-4 mr-2" /> Revertir a Pendiente
                        </Button>
                    )}
                    {invoice.status === 'pending' && (
                        <Button 
                            variant="ghost" 
                            className="col-span-2 text-red-500 hover:text-red-700 hover:bg-red-50 h-10 mt-2"
                            onClick={() => onStatusChange(invoice.id, 'deleted')}
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Anular Factura
                        </Button>
                    )}
                </div>
            </div>
        </Dialog>
    );
};
