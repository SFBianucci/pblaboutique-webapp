import React, { useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { CheckCircle, Printer, Download, Undo2, Trash2, FileText, Eye, X, AlertTriangle } from 'lucide-react';
import { Invoice } from '../types';
import { formatCurrency } from '../lib/utils';

interface InvoiceDetailModalProps {
    invoice: Invoice | null;
    onClose: () => void;
    onStatusChange: (id: string, newStatus: Invoice['status']) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, onClose, onStatusChange }) => {
    if (!invoice) return null;
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const hasLinkedDocument = Boolean(invoice.fileDataUrl);
    const isPdfDocument = Boolean(
        (invoice.fileName || '').toLowerCase().endsWith('.pdf') ||
        (invoice.fileDataUrl || '').toLowerCase().startsWith('data:application/pdf') ||
        (invoice.fileDataUrl || '').toLowerCase().includes('.pdf')
    );

    const openLinkedDocument = () => {
        if (!invoice.fileDataUrl) return;
        window.open(invoice.fileDataUrl, '_blank', 'noopener,noreferrer');
    };

    const downloadLinkedDocument = () => {
        if (!invoice.fileDataUrl) return;

        const sanitizeSegment = (value: string) =>
            String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');

        const invoicePart = sanitizeSegment(invoice.invoiceNumber || invoice.id || 'Factura');
        const insurancePart = sanitizeSegment(invoice.insurance || 'Seguro');
        const datePart = sanitizeSegment((invoice.date || '').replace(/\//g, '-'));

        const originalName = String(invoice.fileName || '').trim();
        const extensionMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
        const extension = extensionMatch
            ? `.${extensionMatch[1].toLowerCase()}`
            : (isPdfDocument ? '.pdf' : '.bin');

        const composedName = [invoicePart, insurancePart, datePart]
            .filter(Boolean)
            .join('_');

        const anchor = document.createElement('a');
        anchor.href = invoice.fileDataUrl;
        anchor.download = `${composedName || 'Factura'}${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    };

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
        <>
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
                            <div className="text-sm text-gray-800 font-medium bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                    <span className="truncate">{invoice.fileName}</span>
                                </span>
                                {hasLinkedDocument && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-100"
                                        onClick={() => setIsPreviewOpen(true)}
                                        title="Ver adjunto"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
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
                    <Button
                        variant="outline"
                        className="h-10 border-gray-300 text-gray-600"
                        onClick={openLinkedDocument}
                        disabled={!hasLinkedDocument}
                    >
                        <Printer className="w-4 h-4 mr-2" /> Imprimir
                    </Button>
                    <Button
                        variant="outline"
                        className="h-10 border-gray-300 text-gray-600"
                        onClick={downloadLinkedDocument}
                        disabled={!hasLinkedDocument}
                    >
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

            {isPreviewOpen && hasLinkedDocument && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl h-[90vh] rounded-lg shadow-2xl flex flex-col relative overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-500" /> {invoice.fileName || "Documento"}
                            </h3>
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-900"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-100 relative">
                            {isPdfDocument ? (
                                <object
                                    data={invoice.fileDataUrl}
                                    type="application/pdf"
                                    className="w-full h-full block"
                                >
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
                                        <AlertTriangle className="w-12 h-12 text-gray-300 mb-4" />
                                        <p className="font-medium">No se pudo visualizar el documento directamente.</p>
                                        <button
                                            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                                            onClick={openLinkedDocument}
                                        >
                                            Abrir en nueva pestaña
                                        </button>
                                    </div>
                                </object>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center p-4">
                                    <img
                                        src={invoice.fileDataUrl}
                                        alt={invoice.fileName || 'Factura adjunta'}
                                        className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                                        referrerPolicy="no-referrer"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
