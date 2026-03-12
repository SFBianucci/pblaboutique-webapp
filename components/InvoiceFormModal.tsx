import React, { useState, useRef, useEffect } from 'react';
import { 
  CalendarIcon, Check, ChevronsUpDown, Upload, Loader2, X, FileText, AlertTriangle, Eye, Trash2,
  DollarSign, Hash, Car, FileBadge, Download
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk'; 
import { format } from 'date-fns';

import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Calendar } from './ui/Calendar';
import { parseInvoiceDocument } from '../lib/invoiceParser';
import { cn } from '../lib/utils';

// --- DATOS ---
const INSURANCE_LIST = [
    { label: "ALLIANZ", value: "ALLIANZ", cuit: "30500037217" },
    { label: "ANTARTIDA", value: "ANTARTIDA", cuit: "30500037217" },
    { label: "ATM SEGUROS", value: "ATM", cuit: "30500037217" },
    { label: "ARMORAUT", value: "ARMORAUT", cuit: "30500037217" },
    { label: "BERKLEY", value: "BERKLEY", cuit: "30500037217" },
    { label: "BLEU", value: "BLEU", cuit: "30500037217" },
    { label: "BOSTON", value: "BOSTON", cuit: "30500037217" },
    { label: "CAJA SEGUROS", value: "CAJA", cuit: "30500037217" },
    { label: "COLLINS", value: "COLLINS", cuit: "30500037217" },
    { label: "CIGLIUTTI", value: "CIGLIUTTI", cuit: "30500037217" },
    { label: "CARUSO", value: "CARUSO", cuit: "30500037217" },
    { label: "DARC", value: "DARC", cuit: "30500037217" },
    { label: "DIETRICH", value: "DIETRICH", cuit: "30500037217" },
    { label: "DIGNA", value: "DIGNA", cuit: "30500037217" },
    { label: "ESCUDO", value: "ESCUDO", cuit: "30500037217" },
    { label: "EXPERTA", value: "EXPERTA", cuit: "30500037217" },
    { label: "EQUITATIVA", value: "EQUITATIVA", cuit: "30500037217" },
    { label: "FEDERACION PATRONAL", value: "FEDERACION PAT", cuit: "33707366589" }, 
    { label: "FEDERACION PATRONAL (Viejo)", value: "FEDERACION PAT", cuit: "30500037217" },
    { label: "FINISTERRE", value: "FINISTERRE", cuit: "30500037217" },
    { label: "GALENO", value: "GALENO", cuit: "30500037217" },
    { label: "GALICIA/SURA", value: "GALICIA/SURA", cuit: "30500037217" },
    { label: "HDI", value: "HDI", cuit: "30500037217" },
    { label: "HOLANDO", value: "HOLANDO", cuit: "30500037217" },
    { label: "INERCIKAR", value: "INERCIKAR", cuit: "30500037217" },
    { label: "IAORANA", value: "IAORANA", cuit: "30500037217" },
    { label: "INTEGRITY", value: "INTEGRITY", cuit: "30500037217" },
    { label: "LIDERAR", value: "LIDERAR", cuit: "30500037217" },
    { label: "LIBRA", value: "LIBRA", cuit: "30500037217" },
    { label: "MERCANTIL ANDINA", value: "MERCANTIL ANDINA", cuit: "30500037217" },
    { label: "MOVILAUT", value: "MOVILAUT", cuit: "30500037217" },
    { label: "METROPOL", value: "METROPOL", cuit: "30500037217" },
    { label: "NACION SEGUROS", value: "NACION", cuit: "30500037217" },
    { label: "NIVEL", value: "NIVEL", cuit: "30500037217" },
    { label: "ORBIS", value: "ORBIS", cuit: "30500037217" },
    { label: "PARANA SEGUROS", value: "PARANA", cuit: "30500037217" },
    { label: "PROVINCIA SEGUROS", value: "PROVINCIA", cuit: "30500037217" },
    { label: "PROVIDENCIA", value: "PROVIDENCIA", cuit: "30500037217" },
    { label: "PERSERVERANCIA", value: "PERSERVERANCIA", cuit: "30500037217" },
    { label: "RIO URUGUAY", value: "RIO URUGUAY", cuit: "30500037217" },
    { label: "RUSSONIELLO", value: "RUSSONIELLO", cuit: "30500037217" },
    { label: "RIVADAVIA", value: "RIVADAVIA", cuit: "30500037217" },
    { label: "SANCOR", value: "SANCOR", cuit: "30500037217" },
    { label: "SMG", value: "SMG", cuit: "30500037217" },
    { label: "LA SEGUNDA", value: "SEGUNDA", cuit: "30500037217" },
    { label: "SEGURCOOP", value: "SEGURCOOP", cuit: "30500057277" },
    { label: "SAN CRISTOBAL", value: "SAN CRISTOBAL", cuit: "34500045339" },
    { label: "STAMPA", value: "STAMPA", cuit: "30696493479" },
    { label: "TRIUNFO", value: "TRIUNFO", cuit: "30500065776" },
    { label: "TPC", value: "TPC", cuit: "30708017473" },
    { label: "VICTORIA", value: "VICTORIA", cuit: "30500032266" },
    { label: "WAGEN", value: "WAGEN", cuit: "30696503962" },
    { label: "ZURICH", value: "ZURICH", cuit: "30500049770" },
    { label: "ZURICH QBE", value: "ZURICH QBE", cuit: "30500036393" },
    { label: "GAULOIS", value: "GAULOIS", cuit: "30696509219" },
    { label: "ANSWER", value: "ANSWER", cuit: "33574332449" },
    { label: "CHUBB", value: "CHUBB", cuit: "30500016260" },
    { label: "MECANICA BRAGADO", value: "MECANICA BRAGADO", cuit: "" },
    { label: "ALQUILER", value: "ALQUILER", cuit: "" },
    { label: "TALLER", value: "TALLER", cuit: "0" },
    { label: "COOPERACION PATRONAL", value: "COOPERACION PATRONAL", cuit: "" },
    { label: "PARTICULAR", value: "PARTICULAR", cuit: "" },
];

const INVOICE_TYPES = [
    "Factura A",
    "Nota de Credito - Factura A",
    "Factura B - Exenta IVA",
    "MiPyme",
    "Nota de Credito - Factura B",
    "Factura B",
    "Nota de Credito - Factura B Exenta",
    "Nota de Credito - MiPyme"
];

const formatCurrencyInput = (value: string | number) => {
    if (!value && value !== 0) return "";
    const number = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(number)) return "";
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

const parseCurrencyInput = (value: string) => {
    let cleanVal = value;
    if (cleanVal.includes(',') && cleanVal.includes('.')) {
        if (cleanVal.lastIndexOf(',') > cleanVal.lastIndexOf('.')) {
            cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        } else {
            cleanVal = cleanVal.replace(/,/g, '');
        }
    } else if (cleanVal.includes(',')) {
        cleanVal = cleanVal.replace(',', '.');
    }
    return cleanVal;
};

const calculateValues = (totalVal: string, type: string) => {
    const cleanVal = parseCurrencyInput(totalVal);
    const total = parseFloat(cleanVal);
    if (isNaN(total)) return { sub: '', vat: '' };
    
    if (type.includes("Exenta")) {
        return { sub: total.toFixed(2), vat: '0.00' };
    }

    const net = total / 1.21;
    const vat = total - net;
    return { sub: net.toFixed(2), vat: vat.toFixed(2) };
};

interface InvoiceFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: any) => void;
    initialData?: any;
}

export const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({ 
    open, 
    onOpenChange, 
    onSave,
    initialData 
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isParsing, setIsParsing] = useState(false);
    
    // UI States
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [isInsuranceOpen, setIsInsuranceOpen] = useState(false);
    const [isTypeOpen, setIsTypeOpen] = useState(false);
    
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [formData, setFormData] = useState({
        type: 'Factura A',
        insurance: '',
        date: new Date(),
        invoiceNumber: '',
        licensePlate: '',
        siniestro: '',
        amount: '', 
        subtotal: '',
        vat: '',
        description: '',
        fileName: '',
        cancelledInvoice: ''
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                let parsedDate = new Date();
                if (initialData.date) {
                    const [day, month, year] = initialData.date.split('/');
                    if (day && month && year) {
                        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    }
                }
                const initialAmount = initialData.amount?.toString() || '';
                const { sub, vat } = calculateValues(initialAmount, initialData.type || 'Factura A');
                setFormData({
                    ...initialData,
                    date: parsedDate,
                    amount: initialAmount,
                    subtotal: sub,
                    vat: vat
                });
            } else {
                setFormData(prev => ({
                    ...prev,
                    type: 'Factura A',
                    insurance: '',
                    date: new Date(),
                    invoiceNumber: '',
                    licensePlate: '',
                    siniestro: '',
                    amount: '',
                    subtotal: '',
                    vat: '',
                    description: '',
                    fileName: '',
                    cancelledInvoice: ''
                }));
            }
        }
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        };
    }, [open, initialData]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        if (!/^[\d.,]*$/.test(val)) return;
        
        const { sub, vat } = calculateValues(val, formData.type);
        setFormData(prev => ({
            ...prev,
            amount: val,
            subtotal: sub,
            vat: vat
        }));
    };

    const isCreditNote = formData.type.includes("Nota de Credito");

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
            alert("Solo archivos PDF o imágenes (JPEG, PNG, WEBP)");
            return;
        }

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        setIsParsing(true);
        setFormData(prev => ({ ...prev, fileName: file.name }));

        try {
            const data = await parseInvoiceDocument(file);
            
            if (data) {
                // MATCHING SEGURO
                let matchedInsurance = "";
                const extractedName = data.insurance?.toUpperCase() || "";
                const extractedCuit = data.cuit?.replace(/[-\s]/g, '') || "";

                if (extractedCuit) {
                    const foundByCuit = INSURANCE_LIST.find(i => 
                        i.cuit && i.cuit.replace(/[-\s]/g, '') === extractedCuit
                    );
                    if (foundByCuit) matchedInsurance = foundByCuit.value;
                }

                if (!matchedInsurance && extractedName) {
                    const foundByName = INSURANCE_LIST.find(i => {
                        if (i.value.length < 3) return false;
                        return extractedName.includes(i.value) || extractedName.includes(i.label);
                    });
                    if (foundByName) matchedInsurance = foundByName.value;
                }

                if (!matchedInsurance && data.insurance) {
                    if (extractedName.includes("SEGUROS")) {
                        matchedInsurance = "PARTICULAR"; 
                    } else {
                        matchedInsurance = "PARTICULAR";
                    }
                }

                setFormData(prev => {
                    // FECHA SEGURA (Evita cambio de zona horaria)
                    let safeDate = prev.date;
                    if (data.date) {
                        // data.date es 'YYYY-MM-DD'. Dividimos y creamos la fecha localmente
                        const [year, month, day] = data.date.split('-').map(Number);
                        // Mes en JS es 0-11
                        safeDate = new Date(year, month - 1, day);
                    }

                    // TIPO DE COMPROBANTE
                    // El parser devuelve el tipo exacto (ej: "Nota de Credito A").
                    // Verificamos si existe en nuestra lista del modal, si no, intentamos un fallback inteligente.
                    let safeType = data.type || prev.type;
                    if (!INVOICE_TYPES.includes(safeType)) {
                        // Si el tipo devuelto no está exactamente en la lista, intentamos normalizar
                        if (safeType.includes("Nota de Credito") && safeType.includes("A")) safeType = "Nota de Credito - Factura A";
                        else if (safeType.includes("Nota de Credito") && safeType.includes("B")) safeType = "Nota de Credito - Factura B";
                        else if (safeType.includes("Factura") && safeType.includes("A")) safeType = "Factura A";
                        else if (safeType.includes("Factura") && safeType.includes("B")) safeType = "Factura B";
                        // ...otros casos según se necesiten
                    }

                    return {
                        ...prev,
                        type: safeType,
                        insurance: matchedInsurance || prev.insurance,
                        date: safeDate,
                        invoiceNumber: data.invoiceNumber || prev.invoiceNumber,
                        description: data.description || prev.description,
                        licensePlate: data.licensePlate || prev.licensePlate,
                        amount: data.amount ? data.amount.toString() : prev.amount,
                        subtotal: data.subtotal ? data.subtotal.toString() : prev.subtotal,
                        vat: data.vat ? data.vat.toString() : prev.vat,
                        siniestro: data.siniestro || prev.siniestro,
                        cancelledInvoice: data.cancelledInvoice || prev.cancelledInvoice,
                    };
                });
            }
        } catch (error: any) {
            console.error(error);
            alert("Hubo un error al analizar el documento con IA:\n" + error.message);
            
            // Revert invalid file state
            setFormData(prev => ({ ...prev, fileName: '' }));
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
            }
            if(fileInputRef.current) fileInputRef.current.value = '';
        } finally {
            setIsParsing(false);
        }
    };

    const handleSubmit = () => {
        if (!formData.insurance || formData.insurance === "Elegir") {
            alert("Selecciona un Seguro/Cliente");
            return;
        }
        if (!formData.invoiceNumber) {
            alert("Falta el número de factura");
            return;
        }
        if (isCreditNote && !formData.cancelledInvoice) {
            alert("Para una Nota de Crédito debes indicar la factura cancelada.");
            return;
        }

        const cleanAmount = parseCurrencyInput(formData.amount);
        const finalData = {
            ...formData,
            date: format(formData.date, 'dd/MM/yyyy'), 
            amount: parseFloat(cleanAmount) * (isCreditNote ? -1 : 1),
        };

        onSave(finalData);
        onOpenChange(false);
    };

    const clearFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if(fileInputRef.current) fileInputRef.current.value = '';
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }

        setFormData(prev => ({
            ...prev, 
            fileName: '',
            // Reseteamos campos extraídos del PDF
            invoiceNumber: '',
            insurance: '', // SE AGREGÓ RESETEO DE SEGURO EXPLICITO
            amount: '',
            subtotal: '',
            vat: '',
            description: '',
            licensePlate: '',
            siniestro: '',
            date: new Date(), 
            // Nota: Mantenemos 'type' por conveniencia, pero seguro se resetea.
        }));
    };

    const inputBaseStyles = "flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 font-sans ring-offset-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm";
    const labelStyles = "text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1 block";

    return (
        <>
            <Dialog 
                open={open} 
                onOpenChange={onOpenChange} 
                title={initialData ? "Editar Factura" : (isCreditNote ? "Registrar Nota de Crédito" : "Registrar Nueva Factura")} 
                className="max-w-3xl"
            >
                <div className="grid grid-cols-12 gap-4 pt-1">
                    {/* --- FILA 1 --- */}
                    <div className="col-span-12 sm:col-span-4">
                         <label className={labelStyles}>Tipo Comprobante</label>
                         <Popover.Root open={isTypeOpen} onOpenChange={setIsTypeOpen} modal={true}>
                            <Popover.Trigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isTypeOpen}
                                    className={cn(
                                        inputBaseStyles,
                                        "justify-between font-normal text-base hover:bg-white",
                                        isCreditNote ? "border-orange-200 bg-orange-50 text-orange-900" : ""
                                    )}
                                >
                                    <span className="truncate">{formData.type}</span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content className="w-[var(--radix-popover-trigger-width)] p-0 bg-white rounded-lg border border-gray-200 shadow-2xl z-[9999] animate-in fade-in-0 zoom-in-95 overflow-hidden">
                                    <Command className="overflow-hidden bg-white">
                                        <Command.List className="max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                                            {INVOICE_TYPES.map((type) => (
                                                <Command.Item
                                                    key={type}
                                                    value={type}
                                                    onSelect={() => {
                                                        const { sub, vat } = calculateValues(formData.amount, type);
                                                        setFormData({...formData, type, subtotal: sub, vat: vat});
                                                        setIsTypeOpen(false);
                                                    }}
                                                    className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none text-gray-900 hover:bg-gray-50 transition-colors"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.type === type ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {type}
                                                </Command.Item>
                                            ))}
                                        </Command.List>
                                    </Command>
                                </Popover.Content>
                            </Popover.Portal>
                         </Popover.Root>
                    </div>

                    <div className="col-span-12 sm:col-span-4">
                        <label className={labelStyles}>Fecha de Emisión</label>
                        <Popover.Root open={isDateOpen} onOpenChange={setIsDateOpen} modal={true}>
                            <Popover.Trigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        inputBaseStyles,
                                        "justify-start text-left font-normal hover:bg-white font-sans",
                                        !formData.date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50 text-gray-500" />
                                    {formData.date ? format(formData.date, "dd/MM/yyyy") : <span className="text-gray-400">Seleccionar...</span>}
                                </Button>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content className="w-auto p-0 bg-white rounded-lg border shadow-xl z-[9999]" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.date}
                                        onSelect={(date) => {
                                            if(date) {
                                                setFormData({...formData, date});
                                                setIsDateOpen(false);
                                            }
                                        }}
                                        className="rounded-lg border-0"
                                    />
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>
                    </div>

                    <div className="col-span-12 sm:col-span-4">
                        <label className={labelStyles}>Nro. Comprobante</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="0001-00000000" 
                                className={cn(inputBaseStyles, "pl-9 font-mono")}
                                value={formData.invoiceNumber}
                                onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* --- FILA 2 --- */}
                    <div className="col-span-12">
                        <label className={labelStyles}>Cliente / Aseguradora</label>
                        <Popover.Root open={isInsuranceOpen} onOpenChange={setIsInsuranceOpen} modal={true}>
                            <Popover.Trigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isInsuranceOpen}
                                    className={cn(inputBaseStyles, "justify-between font-normal text-base hover:bg-white")}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <FileBadge className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                        <span className={cn("truncate font-sans", !formData.insurance && "text-gray-400")}>
                                            {formData.insurance
                                                ? (INSURANCE_LIST.find((i) => i.value === formData.insurance)?.label || formData.insurance)
                                                : "Seleccionar Cliente o Aseguradora..."}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content className="w-[var(--radix-popover-trigger-width)] p-0 bg-white rounded-lg border border-gray-200 shadow-2xl z-[9999] animate-in fade-in-0 zoom-in-95 max-h-[300px] overflow-hidden">
                                    <Command className="overflow-hidden bg-white">
                                            <div className="flex items-center border-b px-3 border-gray-100" cmdk-input-wrapper="">
                                                <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50 text-gray-500" />
                                                <Command.Input 
                                                    placeholder="Buscar..." 
                                                    className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 text-gray-900 font-sans"
                                                />
                                            </div>
                                            <Command.List className="max-h-[250px] overflow-y-auto p-1 custom-scrollbar">
                                                <Command.Empty className="py-4 text-center text-sm text-gray-500">No encontrado.</Command.Empty>
                                                {INSURANCE_LIST.map((insurance) => (
                                                    <Command.Item
                                                        key={insurance.label}
                                                        value={insurance.label}
                                                        onSelect={() => {
                                                            setFormData({...formData, insurance: insurance.value});
                                                            setIsInsuranceOpen(false);
                                                        }}
                                                        className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none text-gray-900 hover:bg-green-50 hover:text-green-900 transition-colors font-sans"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.insurance === insurance.value ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {insurance.label}
                                                    </Command.Item>
                                                ))}
                                            </Command.List>
                                    </Command>
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>
                    </div>

                    {/* --- FILA 3 --- */}
                    <div className="col-span-12 sm:col-span-6">
                        <label className={labelStyles}>Patente del Vehículo</label>
                        <div className="relative group">
                             <div className="absolute left-0 top-0 bottom-0 w-14 bg-gray-50 border-r border-gray-200 rounded-l-lg flex items-center justify-center group-focus-within:border-green-600 group-focus-within:bg-green-50/30 transition-colors">
                                <Car className="w-5 h-5 text-gray-400 group-focus-within:text-green-600" />
                             </div>
                             <Input 
                                placeholder="AA 123 BB" 
                                className={cn(inputBaseStyles, "pl-16 font-mono uppercase font-bold tracking-wider text-base")}
                                value={formData.licensePlate}
                                onChange={(e) => setFormData({...formData, licensePlate: e.target.value.toUpperCase()})}
                            />
                        </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                        <label className={labelStyles}>N° Siniestro (Opcional)</label>
                        <Input 
                            placeholder="Ej: 518529" 
                            className={inputBaseStyles}
                            value={formData.siniestro}
                            onChange={(e) => setFormData({...formData, siniestro: e.target.value})}
                        />
                    </div>

                    {/* --- FILA 4 --- */}
                    <div className="col-span-12">
                         <label className={labelStyles}>Descripción del Servicio / Detalle</label>
                         <Input 
                            placeholder="Ej: Cambio de Parabrisas c/ colocación..." 
                            className={inputBaseStyles}
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                    </div>

                    {isCreditNote && (
                         <div className="col-span-12 animate-in fade-in slide-in-from-top-2">
                             <label className="text-[11px] font-bold text-orange-700 uppercase tracking-wide mb-1 block">Comprobante a Cancelar</label>
                             <Input 
                                 placeholder="Ej: 0002-00010423" 
                                 className="h-10 border-orange-200 bg-orange-50 text-orange-900 placeholder:text-orange-400 focus:ring-orange-500/20 focus:border-orange-500 w-full rounded-lg px-3"
                                 value={formData.cancelledInvoice}
                                 onChange={(e) => setFormData({...formData, cancelledInvoice: e.target.value})}
                             />
                         </div>
                    )}

                    <div className="col-span-12 h-px bg-gray-100 my-1"></div>

                    {/* --- FILA 5 --- */}
                    <div className="col-span-12 sm:col-span-4">
                        <label className={labelStyles}>Importe Total</label>
                        <div className="relative">
                            <DollarSign className={cn("absolute left-3 top-3 h-5 w-5", isCreditNote ? "text-red-500" : "text-green-600")} />
                            <Input 
                                type="text"
                                placeholder="0.00" 
                                className={cn(
                                    inputBaseStyles,
                                    "pl-9 font-bold tabular-nums font-sans",
                                    isCreditNote ? "text-red-600" : "text-gray-900"
                                )}
                                value={formData.amount}
                                onChange={handleAmountChange}
                            />
                        </div>
                        {isCreditNote && <p className="text-xs text-red-500 mt-1 font-medium">Se registrará como negativo</p>}
                    </div>

                    <div className="col-span-6 sm:col-span-4">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Neto Gravado</label>
                         <Input 
                            className="bg-gray-50 border-gray-200 text-gray-500 font-sans h-10" 
                            readOnly 
                            value={formData.subtotal ? `$ ${formatCurrencyInput(formData.subtotal)}` : ''} 
                            tabIndex={-1} 
                         />
                    </div>
                    <div className="col-span-6 sm:col-span-4">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">IVA (21%)</label>
                         <Input 
                            className="bg-gray-50 border-gray-200 text-gray-500 font-sans h-10" 
                            readOnly 
                            value={formData.vat ? `$ ${formatCurrencyInput(formData.vat)}` : ''} 
                            tabIndex={-1} 
                        />
                    </div>

                    {/* --- FILA 6 --- */}
                    <div className="col-span-12 mt-1">
                        <div 
                            className={cn(
                                "border-2 border-dashed rounded-xl transition-all relative overflow-hidden group",
                                !formData.fileName 
                                    ? "h-16 border-gray-200 hover:border-green-400 hover:bg-green-50/5 cursor-pointer flex items-center justify-center bg-gray-50/50"
                                    : "bg-white border-green-200 shadow-sm p-3"
                            )}
                            onClick={() => !formData.fileName && fileInputRef.current?.click()}
                        >
                            <Input 
                                type="file" 
                                accept="application/pdf,image/jpeg,image/png,image/webp" 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload}
                            />
                            
                            {!formData.fileName ? (
                                <div className="flex items-center gap-3 text-gray-400 group-hover:text-green-600 transition-colors">
                                    <div className="p-2 bg-white rounded-full shadow-sm">
                                        {isParsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                                    </div>
                                    <span className="text-sm font-medium">
                                        {isParsing ? "Analizando documento con IA..." : "Click para adjuntar Factura (PDF o Imagen)"}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 w-full">
                                    <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 flex-shrink-0">
                                        {isParsing ? <Loader2 className="h-6 w-6 text-red-500 animate-spin" /> : <FileText className="h-6 w-6 text-red-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{formData.fileName}</p>
                                        {isParsing ? (
                                            <p className="text-xs text-slate-500 font-medium flex items-center mt-0.5">
                                                Analizando documento con IA...
                                            </p>
                                        ) : (
                                            <p className="text-xs text-green-600 font-medium flex items-center mt-0.5">
                                                <Check className="w-3 h-3 mr-1" /> Documento procesado correctamente
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if(previewUrl) setIsPreviewOpen(true); }} title="Ver documento">
                                            <Eye className="w-4 h-4 text-gray-500 hover:text-blue-600" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={clearFile} title="Eliminar" disabled={isParsing}>
                                            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-medium">
                        * Todos los campos son obligatorios para facturación A
                    </p>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-500 hover:text-gray-800">
                            Cancelar
                        </Button>
                        <Button 
                            className={cn(
                                "px-8 font-bold shadow-lg transition-all",
                                isCreditNote ? "bg-orange-600 hover:bg-orange-700 shadow-orange-900/20" : "bg-[#114a28] hover:bg-[#0e3b20] shadow-green-900/20"
                            )}
                            onClick={handleSubmit}
                        >
                            {initialData ? "Guardar Cambios" : (isCreditNote ? "Generar Nota de Crédito" : "Guardar Factura")}
                        </Button>
                    </div>
                </div>
            </Dialog>

             {/* MODAL DE VISTA PREVIA PDF */}
             {isPreviewOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl h-[90vh] rounded-lg shadow-2xl flex flex-col relative overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-red-500" /> {formData.fileName || "Documento"}
                            </h3>
                            <button 
                                onClick={() => setIsPreviewOpen(false)}
                                className="p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-900"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-100 relative">
                             {previewUrl ? (
                                 formData.fileName.toLowerCase().endsWith('.pdf') ? (
                                     <object
                                        data={previewUrl}
                                        type="application/pdf"
                                        className="w-full h-full block"
                                     >
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
                                             <AlertTriangle className="w-12 h-12 text-gray-300 mb-4" />
                                             <p className="font-medium">No se pudo visualizar el documento directamente.</p>
                                             <p className="text-sm text-gray-400 mb-4">Es posible que su navegador bloquee la vista previa.</p>
                                             <a 
                                                href={previewUrl} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                                             >
                                                <Download className="w-4 h-4 mr-2" /> Abrir en nueva pestaña
                                             </a>
                                        </div>
                                     </object>
                                 ) : (
                                     <div className="w-full h-full flex items-center justify-center p-4">
                                         <img src={previewUrl} alt="Vista previa" className="max-w-full max-h-full object-contain rounded-md shadow-sm" referrerPolicy="no-referrer" />
                                     </div>
                                 )
                             ) : (
                                 <div className="flex items-center justify-center h-full text-gray-500 flex-col gap-2">
                                     <AlertTriangle className="w-10 h-10 text-gray-300" />
                                     <p>No se puede visualizar el documento</p>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

function SearchIcon(props: any) {
    return (
      <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    )
}