import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronsUpDown,
  Camera,
  Check,
  CalendarIcon,
  Eye,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  WandSparkles,
  X,
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import * as XLSX from 'xlsx';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/Button';
import { Calendar } from '../components/ui/Calendar';
import { Input } from '../components/ui/Input';
import { Dialog } from '../components/ui/Dialog';
import { formatCurrency } from '../lib/utils';

type ProviderSummary = {
  id: string;
  provider: string;
  balance: number;
  debt: number;
  credit: number;
};

type ProviderMovement = {
  id: string;
  provider: string;
  date: string;
  monthYear: string;
  invoiceNumber: string;
  cancelledInvoiceNumber: string;
  type: string;
  status: string;
  deleted: boolean;
  amount: number;
  balancePre: number;
  balancePost: number;
  debtRunning: number;
  creditRunning: number;
  description: string;
  docId: string;
  hasAttachment?: boolean;
  attachmentDataUrl?: string;
  attachmentMimeType?: string;
  attachmentName?: string;
};

type ProviderDetail = {
  provider: string;
  summary: {
    balance: number;
    debt: number;
    credit: number;
  };
  movements: ProviderMovement[];
  pendingInvoices: { id: string; invoiceNumber: string; amount: number; date: string }[];
};

type MovementFormState = {
  movementId?: string;
  provider: string;
  movementType: 'payment' | 'purchase';
  type: string;
  amount: string;
  date: string;
  invoiceNumber: string;
  observation: string;
  cancelledInvoiceNumbers: string[];
  attachmentDataUrl: string;
  attachmentMimeType: string;
  attachmentName: string;
};

type DetailSortField =
  | 'status'
  | 'date'
  | 'invoiceNumber'
  | 'type'
  | 'debt'
  | 'credit'
  | 'balance'
  | 'description';

type SortDirection = 'asc' | 'desc';

const emptyForm = (provider = '', movementType: 'payment' | 'purchase' = 'purchase'): MovementFormState => ({
  provider,
  movementType,
  type: movementType === 'payment' ? 'Pago' : 'Deuda',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  invoiceNumber: '',
  observation: '',
  cancelledInvoiceNumbers: [],
  attachmentDataUrl: '',
  attachmentMimeType: '',
  attachmentName: '',
});

const statusBadgeClass = (status: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('pago')) return 'bg-slate-200 text-slate-700 border border-slate-300';
  if (normalized.includes('cancelada')) return 'bg-emerald-100 text-emerald-700 border border-emerald-300';
  if (normalized.includes('pendiente')) return 'bg-amber-100 text-amber-700 border border-amber-300';
  if (normalized.includes('anulada')) return 'bg-red-100 text-red-700 border border-red-300';
  return 'bg-gray-100 text-gray-700 border border-gray-300';
};

const toIsoDate = (dateText: string) => {
  const [day, month, year] = String(dateText || '').split('/').map(Number);
  if (!day || !month || !year) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const toInputDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = toIsoDate(value);
  return parsed || new Date().toISOString().slice(0, 10);
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });

const formatSignedCurrency = (value: number) => {
  const numeric = Number(value) || 0;
  const normalized = Math.abs(numeric) < 0.005 ? 0 : numeric;
  if (normalized < 0) return `-${formatCurrency(Math.abs(normalized))}`;
  return formatCurrency(normalized);
};

const parseLocalizedAmount = (value: string) => {
  const text = String(value || '').trim();
  if (!text) return NaN;
  const compact = text.replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');

  let normalized = compact;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastComma > lastDot
        ? compact.replace(/\./g, '').replace(',', '.')
        : compact.replace(/,/g, '');
  } else if (lastComma !== -1) {
    normalized = compact.replace(',', '.');
  } else if (lastDot !== -1) {
    const dotCount = (compact.match(/\./g) || []).length;
    const looksLikeThousands = /^\d{1,3}(\.\d{3})+$/.test(compact);
    normalized = dotCount > 1 || looksLikeThousands ? compact.replace(/\./g, '') : compact;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : NaN;
};

const normalizeAmountInput = (rawValue: string) => {
  let next = String(rawValue || '').replace(/[^0-9.,]/g, '');
  const firstComma = next.indexOf(',');
  if (firstComma !== -1) {
    next = `${next.slice(0, firstComma + 1)}${next.slice(firstComma + 1).replace(/,/g, '')}`;
  }
  return next;
};

const formatLocalizedAmount = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const normalizeAiInvoiceNumber = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const segment = raw.includes('-') ? String(raw.split('-').pop() || '').trim() : raw;
  const digits = segment.replace(/\D/g, '');
  if (!digits) return raw;

  return String(Number(digits));
};

const PAYMENT_TYPE_OPTIONS = [
  { value: 'Pago', label: 'Pago' },
  { value: 'Transferencia', label: 'Transferencia' },
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Nota de crédito', label: 'Nota de crédito' },
];

const isoToDisplayDate = (isoDate: string) => {
  const [year, month, day] = String(isoDate || '').split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
};

const dateToIsoString = (date: Date | undefined) => {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const isoToDate = (value: string) => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

export const Accounts: React.FC = () => {
  const { token, user } = useAuth();

  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingMovement, setIsSavingMovement] = useState(false);
  const [isParsingInvoice, setIsParsingInvoice] = useState(false);

  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [openPurchaseModal, setOpenPurchaseModal] = useState(false);
  const [isAttachmentViewerOpen, setIsAttachmentViewerOpen] = useState(false);
  const [form, setForm] = useState<MovementFormState>(emptyForm());
  const paymentAttachmentInputRef = useRef<HTMLInputElement>(null);
  const purchaseAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState('');
  const [isPaymentTypeOpen, setIsPaymentTypeOpen] = useState(false);
  const [isPaymentDateOpen, setIsPaymentDateOpen] = useState(false);
  const [isPurchaseDateOpen, setIsPurchaseDateOpen] = useState(false);

  const [globalError, setGlobalError] = useState('');
  const [detailSortField, setDetailSortField] = useState<DetailSortField>('date');
  const [detailSortDirection, setDetailSortDirection] = useState<SortDirection>('desc');

  const fetchProviders = async () => {
    if (!token) return;
    setGlobalError('');
    setIsLoadingProviders(true);
    try {
      const response = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'No se pudo cargar Cuenta Corriente');
      setProviders(Array.isArray(payload.providers) ? payload.providers : []);
    } catch (error: any) {
      setGlobalError(error?.message || 'Error cargando proveedores');
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const fetchProviderDetail = async (provider: string) => {
    if (!token || !provider) return;
    setGlobalError('');
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/accounts?provider=${encodeURIComponent(provider)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'No se pudo cargar el detalle del proveedor');
      setDetail(payload as ProviderDetail);
      setSelectedProvider(provider);
    } catch (error: any) {
      setGlobalError(error?.message || 'Error cargando detalle');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [token]);

  const filteredProviders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return providers;
    return providers.filter((provider) => provider.provider.toLowerCase().includes(term));
  }, [providers, searchTerm]);

  const refreshAll = async () => {
    await fetchProviders();
    if (selectedProvider) {
      await fetchProviderDetail(selectedProvider);
    }
  };

  const openMovementModal = (movementType: 'payment' | 'purchase', movement?: ProviderMovement) => {
    const provider = detail?.provider || selectedProvider;
    if (!provider) return;

    if (movement) {
      setForm({
        movementId: movement.id,
        provider,
        movementType,
        type: movement.type || (movementType === 'payment' ? 'Pago' : 'Deuda'),
        amount: formatLocalizedAmount(Math.abs(Number(movement.amount) || 0)),
        date: toInputDate(movement.date),
        invoiceNumber: movement.invoiceNumber === '-' ? '' : movement.invoiceNumber,
        observation: movement.description || '',
        cancelledInvoiceNumbers: movement.cancelledInvoiceNumber
          ? movement.cancelledInvoiceNumber.split(' - ').map((v) => v.trim()).filter(Boolean)
          : [],
        attachmentDataUrl: movement.attachmentDataUrl || '',
        attachmentMimeType: movement.attachmentMimeType || '',
        attachmentName: movement.attachmentName || '',
      });

      if (!movement.attachmentDataUrl && movement.docId && token) {
        fetch('/api/accounts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'getattachment',
            docId: movement.docId,
          }),
        })
          .then(async (response) => {
            const payload = await response.json();
            if (!response.ok || !payload?.found) return;

            setForm((prev) => {
              if (prev.movementId !== movement.id) return prev;
              return {
                ...prev,
                attachmentDataUrl: payload.attachmentDataUrl || prev.attachmentDataUrl,
                attachmentMimeType: payload.attachmentMimeType || prev.attachmentMimeType,
                attachmentName: payload.attachmentName || prev.attachmentName,
              };
            });
          })
          .catch(() => {
            // Keep edit flow resilient even when attachment retrieval fails.
          });
      }
    } else {
      setForm(emptyForm(provider, movementType));
    }

    setFormError('');
    if (movementType === 'payment') {
      setOpenPaymentModal(true);
      setOpenPurchaseModal(false);
    } else {
      setOpenPurchaseModal(true);
      setOpenPaymentModal(false);
    }
  };

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((prev) => ({
      ...prev,
      attachmentDataUrl: dataUrl,
      attachmentMimeType: file.type || '',
      attachmentName: file.name || '',
    }));
  };

  const analyzeInvoiceWithGemini = async () => {
    if (!form.attachmentDataUrl) return;
    setIsParsingInvoice(true);
    setFormError('');

    try {
      const base64Payload = form.attachmentDataUrl.split(',')[1] || '';
      if (!base64Payload) throw new Error('Archivo inválido para analizar');

      const response = await fetch('/api/parse-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64Payload,
          mimeType: form.attachmentMimeType || 'application/pdf',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'No se pudo analizar la factura');

      setForm((prev) => ({
        ...prev,
        invoiceNumber: normalizeAiInvoiceNumber(payload.invoiceNumber) || prev.invoiceNumber,
        amount: Number.isFinite(Number(payload.amount)) ? formatLocalizedAmount(Number(payload.amount)) : prev.amount,
        date: payload.date ? String(payload.date).slice(0, 10) : prev.date,
        type: payload.type || prev.type,
        observation: payload.description || prev.observation,
      }));
    } catch (error: any) {
      setFormError(error?.message || 'Error analizando factura con IA');
    } finally {
      setIsParsingInvoice(false);
    }
  };

  const saveMovement = async () => {
    if (!token || !detail?.provider) return;
    setFormError('');

    const parsedAmount = parseLocalizedAmount(form.amount);

    if (!form.provider || !form.amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Proveedor y monto son obligatorios.');
      return;
    }

    if (form.movementType === 'purchase' && !form.invoiceNumber.trim()) {
      setFormError('El número de factura es obligatorio para compras.');
      return;
    }

    if (
      form.movementType === 'payment' &&
      String(form.type || '').trim().toLowerCase() === 'nota de crédito' &&
      !form.invoiceNumber.trim()
    ) {
      setFormError('El número de factura es obligatorio para notas de crédito.');
      return;
    }

    setIsSavingMovement(true);

    try {
      const action = form.movementId ? 'update' : 'create';
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          movementId: form.movementId,
          provider: form.provider,
          movementType: form.movementType,
          type: form.type,
          amount: parsedAmount,
          date: form.date,
          invoiceNumber: form.invoiceNumber,
          observation: form.observation,
          cancelledInvoiceNumbers: form.cancelledInvoiceNumbers,
          attachmentDataUrl: form.attachmentDataUrl,
          attachmentMimeType: form.attachmentMimeType,
          attachmentName: form.attachmentName,
          userName: user?.name || user?.Nombre_U || user?.username || 'WebApp',
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'No se pudo guardar el movimiento');

      setOpenPaymentModal(false);
      setOpenPurchaseModal(false);
      setIsAttachmentViewerOpen(false);
      setForm(emptyForm(detail.provider, 'purchase'));
      await fetchProviders();
      await fetchProviderDetail(detail.provider);
    } catch (error: any) {
      setFormError(error?.message || 'Error guardando movimiento');
    } finally {
      setIsSavingMovement(false);
    }
  };

  const updateMovementStatus = async (movement: ProviderMovement, nextStatus: string) => {
    if (!token || !detail) return;

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          movementId: movement.id,
          status: nextStatus,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'No se pudo actualizar estado');
      await fetchProviders();
      await fetchProviderDetail(detail.provider);
    } catch (error: any) {
      setGlobalError(error?.message || 'Error actualizando estado');
    }
  };

  const deleteMovement = async (movement: ProviderMovement) => {
    if (!token || !detail) return;
    if (!window.confirm('¿Querés borrar este movimiento? Se recalculará el balance del proveedor.')) return;

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          movementId: movement.id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'No se pudo borrar el movimiento');
      await fetchProviders();
      await fetchProviderDetail(detail.provider);
    } catch (error: any) {
      setGlobalError(error?.message || 'Error borrando movimiento');
    }
  };

  const exportProvidersExcel = () => {
    const data = filteredProviders.map((provider) => ({
      Proveedor: provider.provider,
      Saldo: provider.balance,
      Deuda: provider.debt,
      Haber: provider.credit,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CuentaCorriente');
    XLSX.writeFile(workbook, `CuentaCorriente_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportDetailExcel = () => {
    if (!detail) return;

    const data = movementRows.map((movement) => {
      const isPurchase = movement.amount > 0;
      const absoluteAmount = Math.abs(Number(movement.amount) || 0);
      return {
        Estado: movement.status,
        Fecha: movement.date,
        NroFactura: movement.invoiceNumber || '-',
        Tipo: movement.type || (isPurchase ? 'Compra' : 'Pago'),
        Deuda: isPurchase ? absoluteAmount : 0,
        Haber: isPurchase ? 0 : absoluteAmount,
        Saldo: Number(movement.balancePost) || 0,
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DetalleCuenta');

    const safeProviderName = String(detail.provider || 'Proveedor')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Proveedor';

    XLSX.writeFile(workbook, `CuentaCorriente_Detalle_${safeProviderName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const movementRows = useMemo(() => {
    const rows = [...(detail?.movements || [])];

    const compareText = (a: string, b: string) =>
      String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
    const parseDateValue = (dateText: string) => {
      const [d, m, y] = String(dateText || '').split('/').map(Number);
      if (!d || !m || !y) return 0;
      return new Date(y, m - 1, d).getTime();
    };

    rows.sort((a, b) => {
      let result = 0;

      switch (detailSortField) {
        case 'status':
          result = compareText(a.status, b.status);
          break;
        case 'date':
          result = parseDateValue(a.date) - parseDateValue(b.date);
          break;
        case 'invoiceNumber':
          result = compareText(a.invoiceNumber, b.invoiceNumber);
          break;
        case 'type':
          result = compareText(a.type, b.type);
          break;
        case 'debt':
          result = (a.amount > 0 ? Math.abs(a.amount) : 0) - (b.amount > 0 ? Math.abs(b.amount) : 0);
          break;
        case 'credit':
          result = (a.amount < 0 ? Math.abs(a.amount) : 0) - (b.amount < 0 ? Math.abs(b.amount) : 0);
          break;
        case 'balance':
          result = a.balancePost - b.balancePost;
          break;
        case 'description':
          result = compareText(a.description, b.description);
          break;
      }

      if (result === 0) {
        result = Number(a.id) - Number(b.id);
      }

      return detailSortDirection === 'asc' ? result : -result;
    });

    return rows;
  }, [detail?.movements, detailSortField, detailSortDirection]);

  const pendingInvoiceOptions = detail?.pendingInvoices || [];
  const selectedPendingInvoices = useMemo(
    () => pendingInvoiceOptions.filter((invoice) => form.cancelledInvoiceNumbers.includes(invoice.invoiceNumber)),
    [pendingInvoiceOptions, form.cancelledInvoiceNumbers],
  );

  const selectedPendingTotal = useMemo(
    () => selectedPendingInvoices.reduce((acc, invoice) => acc + (Number(invoice.amount) || 0), 0),
    [selectedPendingInvoices],
  );
        const shouldScrollPendingInvoices = pendingInvoiceOptions.length > 6;
        const pendingInvoicesListMaxHeight = shouldScrollPendingInvoices ? 360 : undefined;
  const isModuleBusy = isLoadingProviders || isLoadingDetail || isSavingMovement || isParsingInvoice;
  const loadingMessage = isSavingMovement
    ? 'Guardando movimiento...'
    : isParsingInvoice
      ? 'Analizando factura con IA...'
      : isLoadingDetail
        ? 'Cargando detalle del proveedor...'
        : 'Cargando cuenta corriente...';

  useEffect(() => {
    if (!openPaymentModal) return;
    if (form.cancelledInvoiceNumbers.length === 0) return;

          const roundedAmount = Math.round(selectedPendingTotal * 100) / 100;
          const nextAmount = formatLocalizedAmount(roundedAmount);
    setForm((prev) => (prev.amount === nextAmount ? prev : { ...prev, amount: nextAmount }));
  }, [openPaymentModal, form.cancelledInvoiceNumbers, selectedPendingTotal]);

  const toggleDetailSort = (field: DetailSortField) => {
    if (detailSortField === field) {
      setDetailSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setDetailSortField(field);
    setDetailSortDirection(field === 'date' ? 'desc' : 'asc');
  };

  const renderSortIcon = (field: DetailSortField) => {
    if (detailSortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return detailSortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
    );
  };

  return (
    <div className="space-y-4">
      {isModuleBusy ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-200">
          <div className="bg-white/95 p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[280px] w-full mx-4 border border-white/20">
            <Loader2 className="w-8 h-8 text-[#113123] animate-spin mb-3" />
            <h2 className="text-[#113123] text-lg font-bold mb-1 tracking-tight">Procesando</h2>
            <p className="text-gray-600 text-[11px] text-center leading-relaxed">{loadingMessage}</p>
          </div>
        </div>
      ) : null}

      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap xl:flex-nowrap gap-4 items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-4 w-full xl:w-auto flex-1 min-w-0">
          {!detail ? (
            <div className="hidden xl:block pr-6 border-r border-slate-100 flex-none">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Cuenta Corriente</h1>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Gestión de proveedores y movimientos</p>
            </div>
          ) : null}

          <div className="flex items-center gap-2 min-w-0">
          {detail ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => {
                setSelectedProvider('');
                setDetail(null);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver
            </Button>
          ) : null}

          {detail ? <h2 className="text-xl font-bold text-slate-800 ml-1 truncate">{`Cuenta Corriente · ${detail.provider}`}</h2> : null}
        </div>
        </div>

        <div className="flex items-center gap-2 w-full xl:w-auto justify-between xl:justify-end flex-shrink-0">
          <Button
            variant="outline"
            className="h-10 rounded-xl text-slate-600 border-slate-200 bg-white hover:bg-slate-50"
            onClick={refreshAll}
            isLoading={isLoadingProviders || isLoadingDetail}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
          </Button>

          {detail ? (
            <>
              <Button
                variant="outline"
                className="h-10 rounded-xl bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                onClick={exportDetailExcel}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar detalle
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl text-slate-700 border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => openMovementModal('payment')}
              >
                Ingresar Pago <Plus className="w-4 h-4 ml-2" />
              </Button>
              <Button
                className="h-10 rounded-xl bg-[#0f8f4a] hover:bg-[#0d7a3f] text-white shadow-sm"
                onClick={() => openMovementModal('purchase')}
              >
                Ingresar Factura <Plus className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : null}

          {!detail ? (
            <div className="relative w-[260px] group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
              <Input
                placeholder="Buscar proveedor..."
                className="h-10 pl-9 bg-slate-50/50 border-slate-200/70 focus:bg-white rounded-xl"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          ) : null}

          {!detail ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              onClick={exportProvidersExcel}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
          ) : null}
        </div>
      </div>

      {globalError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {globalError}
        </div>
      ) : null}

      {!detail ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-white flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Estado de Cuenta por Proveedor</h3>
            <span className="text-[11px] text-slate-500 font-medium">
              {filteredProviders.length} {filteredProviders.length === 1 ? 'proveedor' : 'proveedores'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 text-slate-500 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5 text-left">Proveedor</th>
                  <th className="py-3 px-5 text-right">Saldo</th>
                  <th className="py-3 px-5 text-right">Deuda</th>
                  <th className="py-3 px-5 text-right">Haber</th>
                  <th className="py-3 px-5 text-center w-[120px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
              {isLoadingProviders ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Cargando proveedores...
                    </span>
                  </td>
                </tr>
              ) : null}

              {!isLoadingProviders && filteredProviders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 italic text-sm">
                    No hay proveedores para mostrar.
                  </td>
                </tr>
              ) : null}

              {!isLoadingProviders &&
                filteredProviders.map((provider) => (
                  <tr key={provider.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100 shrink-0">
                          {provider.provider.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-bold text-slate-800 truncate">{provider.provider}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-slate-800 tabular-nums">{formatCurrency(provider.balance)}</td>
                    <td className="py-3.5 px-5 text-right font-bold text-red-700 tabular-nums">{formatCurrency(provider.debt)}</td>
                    <td className="py-3.5 px-5 text-right font-bold text-sky-700 tabular-nums">{formatCurrency(provider.credit)}</td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={() => fetchProviderDetail(provider.provider)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white hover:border-slate-300 transition-all"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden h-[calc(100vh-7.75rem)] min-h-[650px] flex flex-col">
            <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/90 text-slate-500 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="py-3 px-4 text-left">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-slate-800" onClick={() => toggleDetailSort('status')}>
                      Estado {renderSortIcon('status')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-left">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-slate-800" onClick={() => toggleDetailSort('date')}>
                      Fecha {renderSortIcon('date')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-left">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 hover:text-slate-800"
                      onClick={() => toggleDetailSort('invoiceNumber')}
                    >
                      Nro Factura {renderSortIcon('invoiceNumber')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-left">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-slate-800" onClick={() => toggleDetailSort('type')}>
                      Tipo {renderSortIcon('type')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 hover:text-slate-800 ml-auto"
                      onClick={() => toggleDetailSort('debt')}
                    >
                      Deuda {renderSortIcon('debt')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 hover:text-slate-800 ml-auto"
                      onClick={() => toggleDetailSort('credit')}
                    >
                      Haber {renderSortIcon('credit')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 hover:text-slate-800 ml-auto"
                      onClick={() => toggleDetailSort('balance')}
                    >
                      Saldo {renderSortIcon('balance')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-left">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 hover:text-slate-800"
                      onClick={() => toggleDetailSort('description')}
                    >
                      Descripción {renderSortIcon('description')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-center w-[120px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {isLoadingDetail ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Cargando movimientos...
                      </span>
                    </td>
                  </tr>
                ) : null}

                {!isLoadingDetail && movementRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-500">
                      Este proveedor no tiene movimientos.
                    </td>
                  </tr>
                ) : null}

                {!isLoadingDetail &&
                  movementRows.map((movement, index) => {
                    const isPurchase = movement.amount > 0;
                    const absoluteAmount = Math.abs(Number(movement.amount) || 0);
                    const previousMovement = index > 0 ? movementRows[index - 1] : null;
                    const hasCut = previousMovement ? (previousMovement.amount > 0) !== isPurchase : false;
                    const isCancelled = String(movement.status).toLowerCase().includes('cancelada');
                    const canToggleStatus = isPurchase && !String(movement.status).toLowerCase().includes('anulada');

                    return (
                      <tr
                        key={movement.id}
                        className={`align-top hover:bg-slate-50/70 transition-colors ${
                          isPurchase ? 'bg-rose-50/[0.14]' : 'bg-emerald-50/[0.14]'
                        } ${hasCut ? 'border-t-2 border-t-slate-300' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 text-xs rounded ${statusBadgeClass(movement.status)}`}>
                            {movement.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{movement.date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{movement.invoiceNumber || '-'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isPurchase
                                ? 'text-rose-700 bg-rose-50 border-rose-200'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            }`}
                          >
                            {movement.type || (isPurchase ? 'Compra' : 'Pago')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums text-rose-700">
                          {isPurchase ? formatCurrency(absoluteAmount) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums text-emerald-700">
                          {!isPurchase ? formatCurrency(absoluteAmount) : <span className="text-slate-300">-</span>}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold tabular-nums ${
                            movement.balancePost < 0 ? 'text-rose-700' : 'text-slate-900'
                          }`}
                        >
                          {formatSignedCurrency(movement.balancePost)}
                        </td>
                        <td className="py-3 px-4 max-w-[260px]">
                          <p className="truncate text-slate-600">{movement.description || '-'}</p>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center justify-center gap-1">
                            {!isCancelled ? (
                              <button
                                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 bg-white"
                                title="Editar"
                                onClick={() => openMovementModal(isPurchase ? 'purchase' : 'payment', movement)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                            {canToggleStatus ? (
                              String(movement.status).toLowerCase().includes('pendiente') ? (
                                <button
                                  className="p-1.5 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white"
                                  title="Marcar como cancelada"
                                  onClick={() => updateMovementStatus(movement, 'Cancelada')}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  className="p-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 bg-white"
                                  title="Volver a pendiente"
                                  onClick={() => updateMovementStatus(movement, 'Pendiente')}
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            ) : null}
                            {!isCancelled ? (
                              <button
                                className="p-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 bg-white"
                                title="Borrar"
                                onClick={() => deleteMovement(movement)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            </div>

              <div className="border-t border-slate-100 bg-slate-50/95 px-4 py-3 mt-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saldo Total</p>
                    <p
                      className={`text-xl font-extrabold mt-1 tabular-nums ${
                        detail.summary.balance < 0 ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {formatSignedCurrency(detail.summary.balance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/40 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Deuda Total</p>
                    <p className="text-xl font-extrabold text-rose-700 mt-1 tabular-nums">{formatCurrency(detail.summary.debt)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Haber Total</p>
                    <p className="text-xl font-extrabold text-emerald-700 mt-1 tabular-nums">{formatCurrency(detail.summary.credit)}</p>
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}

      <Dialog
        open={openPaymentModal}
        onOpenChange={(open) => {
          setOpenPaymentModal(open);
          if (!open) {
            setFormError('');
            setIsAttachmentViewerOpen(false);
          }
        }}
        title={`${form.movementId ? 'Editar Pago' : 'Agregar Pago'} · ${form.provider || '-'}`}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Tipo de pago</label>
                <Popover.Root open={isPaymentTypeOpen} onOpenChange={setIsPaymentTypeOpen}>
                  <Popover.Trigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full justify-between rounded-lg border-slate-300 bg-white px-3 text-sm font-normal"
                    >
                      <span>{form.type || 'Seleccionar tipo'}</span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="z-[10002] w-[--radix-popover-trigger-width] rounded-xl border border-slate-200 bg-white p-1 shadow-xl" sideOffset={6}>
                      <Command className="w-full">
                        <Command.List className="max-h-[220px] overflow-y-auto p-1">
                          {PAYMENT_TYPE_OPTIONS.map((option) => (
                            <Command.Item
                              key={option.value}
                              value={option.value}
                              onSelect={() => {
                                setForm((prev) => ({ ...prev, type: option.value }));
                                setIsPaymentTypeOpen(false);
                              }}
                              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer data-[selected=true]:bg-slate-100"
                            >
                              <span>{option.label}</span>
                              <Check className={`h-4 w-4 ${form.type === option.value ? 'opacity-100 text-emerald-600' : 'opacity-0'}`} />
                            </Command.Item>
                          ))}
                        </Command.List>
                      </Command>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Fecha</label>
                <Popover.Root open={isPaymentDateOpen} onOpenChange={setIsPaymentDateOpen}>
                  <Popover.Trigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full justify-between rounded-lg border-slate-300 bg-white px-3 text-sm font-normal"
                    >
                      <span>{isoToDisplayDate(form.date) || 'Seleccionar fecha'}</span>
                      <CalendarIcon className="h-4 w-4 text-slate-500" />
                    </Button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="z-[10002]" sideOffset={6}>
                      <Calendar
                        mode="single"
                        selected={isoToDate(form.date)}
                        onSelect={(date) => {
                          const iso = dateToIsoString(date);
                          if (iso) setForm((prev) => ({ ...prev, date: iso }));
                          setIsPaymentDateOpen(false);
                        }}
                      />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Facturas a cancelar</label>
              <p className="text-xs text-slate-400 mb-2">Seleccioná una o más facturas</p>
              <div
                className={`space-y-1.5 pr-2 ${shouldScrollPendingInvoices ? 'overflow-y-auto' : ''}`}
                style={{ maxHeight: pendingInvoicesListMaxHeight }}
              >
                {pendingInvoiceOptions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                    No hay facturas pendientes para cancelar.
                  </div>
                ) : (
                  pendingInvoiceOptions.map((invoice) => {
                    const isSelected = form.cancelledInvoiceNumbers.includes(invoice.invoiceNumber);
                    return (
                      <button
                        key={invoice.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            cancelledInvoiceNumbers: isSelected
                              ? prev.cancelledInvoiceNumbers.filter((n) => n !== invoice.invoiceNumber)
                              : [...prev.cancelledInvoiceNumbers, invoice.invoiceNumber],
                          }));
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 border transition-all ${
                          isSelected
                            ? 'border-emerald-700 bg-emerald-50'
                            : 'border-slate-300 bg-white hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border ${
                              isSelected ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-slate-400 bg-white text-transparent'
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          <div className="text-left">
                            <p className={`text-sm font-medium ${isSelected ? 'text-emerald-900' : 'text-slate-900'}`}># {invoice.invoiceNumber}</p>
                            <p className={`text-xs ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`}>{invoice.date}</p>
                          </div>
                        </div>
                        <p className={`text-sm font-semibold ${isSelected ? 'text-emerald-900' : 'text-slate-900'}`}>{formatCurrency(invoice.amount)}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Monto</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: normalizeAmountInput(event.target.value) }))}
                  onBlur={() => {
                    const parsed = parseLocalizedAmount(form.amount);
                    if (!Number.isFinite(parsed)) return;
                    const rounded = Math.round(parsed * 100) / 100;
                    setForm((prev) => ({ ...prev, amount: formatLocalizedAmount(rounded) }));
                  }}
                  className="font-semibold rounded-lg border-slate-300"
                />
                <p className="mt-1 text-[11px] text-slate-500">Podés ingresar un pago parcial aunque selecciones facturas.</p>
              </div>
              {String(form.type || '').trim().toLowerCase() === 'nota de crédito' ? (
                <div>
                  <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Nro factura (nota de crédito)</label>
                  <Input
                    placeholder="Ej: 0001-00012345"
                    value={form.invoiceNumber}
                    className="rounded-lg border-slate-300"
                    onChange={(event) => setForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Referencia</label>
                  <Input
                    placeholder="Opcional"
                    value={form.invoiceNumber}
                    className="rounded-lg border-slate-300"
                    onChange={(event) => setForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Observaciones</label>
              <textarea
                rows={2}
                placeholder="Notas adicionales..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
                value={form.observation}
                onChange={(event) => setForm((prev) => ({ ...prev, observation: event.target.value }))}
              />
            </div>

            <div className="pt-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 px-4 py-3 -mx-4 -mb-4 rounded-b-xl">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={`h-10 rounded-lg border ${
                    form.attachmentDataUrl
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-300'
                  }`}
                  onClick={() => paymentAttachmentInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {form.attachmentDataUrl ? 'Archivo subido' : 'Subir archivo'}
                </Button>
                <input
                  ref={paymentAttachmentInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleAttachmentChange}
                />

                {form.attachmentDataUrl ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                      title="Cambiar archivo"
                      onClick={() => paymentAttachmentInputRef.current?.click()}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                      title="Ver archivo"
                      onClick={() => setIsAttachmentViewerOpen(true)}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-10 rounded-lg border-slate-300" onClick={() => setOpenPaymentModal(false)}>
                  Cancelar
                </Button>
                <Button className="h-10 rounded-lg bg-[#1D9E75] hover:bg-[#0F6E56]" onClick={saveMovement} isLoading={isSavingMovement}>
                  {form.movementId ? 'Guardar pago' : 'Agregar pago'}
                </Button>
              </div>
            </div>
          </div>

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </Dialog>

      

      <Dialog
        open={openPurchaseModal}
        onOpenChange={(open) => {
          setOpenPurchaseModal(open);
          if (!open) {
            setFormError('');
            setIsAttachmentViewerOpen(false);
          }
        }}
        title={`${form.movementId ? 'Editar Factura de Compra' : 'Agregar Factura de Compra'} · ${form.provider || '-'}`}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Nro Factura</label>
                <Input
                  value={form.invoiceNumber}
                  className="rounded-lg border-slate-300"
                  onChange={(event) => setForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                  placeholder="Ej: 0001-00012345"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Fecha</label>
                <Popover.Root open={isPurchaseDateOpen} onOpenChange={setIsPurchaseDateOpen}>
                  <Popover.Trigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full justify-between rounded-lg border-slate-300 bg-white px-3 text-sm font-normal"
                    >
                      <span>{isoToDisplayDate(form.date) || 'Seleccionar fecha'}</span>
                      <CalendarIcon className="h-4 w-4 text-slate-500" />
                    </Button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="z-[10002]" sideOffset={6}>
                      <Calendar
                        mode="single"
                        selected={isoToDate(form.date)}
                        onSelect={(date) => {
                          const iso = dateToIsoString(date);
                          if (iso) setForm((prev) => ({ ...prev, date: iso }));
                          setIsPurchaseDateOpen(false);
                        }}
                      />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Monto</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: normalizeAmountInput(event.target.value) }))}
                  onBlur={() => {
                    const parsed = parseLocalizedAmount(form.amount);
                    if (!Number.isFinite(parsed)) return;
                    const rounded = Math.round(parsed * 100) / 100;
                    setForm((prev) => ({ ...prev, amount: formatLocalizedAmount(rounded) }));
                  }}
                  className="font-semibold rounded-lg border-slate-300"
                  placeholder="Ej: 2.000.000,65"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Proveedor</label>
                <Input value={form.provider} disabled className="rounded-lg border-slate-200 bg-slate-100 text-slate-700" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-500 tracking-[0.05em] uppercase block mb-1.5">Observaciones</label>
              <textarea
                rows={2}
                placeholder="Notas adicionales..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
                value={form.observation}
                onChange={(event) => setForm((prev) => ({ ...prev, observation: event.target.value }))}
              />
            </div>

            <div className="pt-3 border-t border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 px-4 py-3 -mx-4 -mb-4 rounded-b-xl">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={`h-10 rounded-lg border ${
                    form.attachmentDataUrl
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-300'
                  }`}
                  onClick={() => purchaseAttachmentInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {form.attachmentDataUrl ? 'Archivo subido' : 'Subir archivo'}
                </Button>
                <input
                  ref={purchaseAttachmentInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleAttachmentChange}
                />

                {form.attachmentDataUrl ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                      title="Cambiar archivo"
                      onClick={() => purchaseAttachmentInputRef.current?.click()}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                      title="Ver archivo"
                      onClick={() => setIsAttachmentViewerOpen(true)}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-lg border-slate-300 ml-1"
                  onClick={analyzeInvoiceWithGemini}
                  disabled={!form.attachmentDataUrl || isParsingInvoice}
                >
                  {isParsingInvoice ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <WandSparkles className="w-4 h-4 mr-2" />}
                  Completar con IA
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-10 rounded-lg border-slate-300" onClick={() => setOpenPurchaseModal(false)}>
                  Cancelar
                </Button>
                <Button className="h-10 rounded-lg bg-[#1D9E75] hover:bg-[#0F6E56]" onClick={saveMovement} isLoading={isSavingMovement}>
                  {form.movementId ? 'Guardar factura' : 'Agregar factura'}
                </Button>
              </div>
            </div>
          </div>

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </Dialog>

        <Dialog
        open={isAttachmentViewerOpen && Boolean(form.attachmentDataUrl)}
        onOpenChange={setIsAttachmentViewerOpen}
        title={`Visualizador · ${form.attachmentName || 'Archivo adjunto'}`}
        className="max-w-4xl"
      >
        <div className="space-y-3">
          {String(form.attachmentMimeType || '').startsWith('image/') ? (
            <img
              src={form.attachmentDataUrl}
              alt={form.attachmentName || 'Archivo adjunto'}
              className="max-h-[70vh] w-full object-contain rounded-md bg-white border border-slate-200"
            />
          ) : String(form.attachmentMimeType || '').includes('pdf') ? (
            <iframe
              title={form.attachmentName || 'Vista previa'}
              src={form.attachmentDataUrl}
              className="h-[70vh] w-full rounded-md border border-slate-200 bg-white"
            />
          ) : (
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
              No hay vista previa para este tipo de archivo.
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};
