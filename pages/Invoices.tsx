import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from 'react-router-dom';
import {
  Search,
  FileSpreadsheet,
  Plus,
  Download,
  Printer,
  Trash2,
  CheckCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  FileText,
  CheckSquare,
  Square,
  X,
  AlertCircle,
  Undo2,
  DollarSign,
  AlertTriangle,
  List,
  Filter,
  Edit2,
  Loader2,
  CalendarIcon,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as Popover from '@radix-ui/react-popover';
import { format, parse, isValid, startOfDay, endOfDay, subMonths, startOfMonth } from 'date-fns';
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Calendar } from "../components/ui/Calendar";
import { Invoice } from "../types";
import { cn, formatCurrency } from "../lib/utils";
import { InvoiceFormModal } from "../components/InvoiceFormModal";
import { BulkActionModal, BulkActionType } from "../components/BulkActionModal";
import { InvoiceDetailModal } from "../components/InvoiceDetailModal";
import { useAppData } from "../lib/AppDataContext";
import { useAuth } from "../lib/AuthContext";
// @ts-ignore
import * as XLSX from "xlsx";

const mapBackendStatusToUiStatus = (statusRaw: string) => {
  const status = (statusRaw || "").trim().toLowerCase();
  if (status === "cobrada") return "paid";
  if (status === "anulada") return "deleted";
  if (status === "vencida") return "deleted";
  return "pending";
};

const mapResumenFacturaToInvoices = (items: any[]): Invoice[] => {
  return items.map((inv) => ({
    id: String(inv.id),
    date: inv.Fecha_RF || "",
    insurance: inv.Seguro_RF || "S/D",
    invoiceNumber: String(inv.NroFactura_RF || ""),
    licensePlate: inv.Patente_RF || "",
    type: inv.TipoFactura_RF || "Factura",
    amount: Number(inv.Total_RF) || 0,
    status: mapBackendStatusToUiStatus(inv.Status_RF || inv.Status_x0020_RF || "") as Invoice["status"],
    description: inv.Servicio_RF || "",
    siniestro: inv.Siniestro_RF || "",
    fileName: inv.fileName || inv.PDFFactura_FFS || "",
    fileDataUrl: inv.fileDataUrl || inv.DocumentoFactura_FFS || "",
    cancelledInvoice: String(inv.NroFacturaCancelacion_RF || "").trim(),
  }));
};

const normalizeText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isCreditNoteInvoice = (inv: Invoice) => {
  const type = normalizeText(inv.type);
  return type.includes("nota de credito") || type.startsWith("nc") || type.includes(" nc ");
};

const isCancelledByCreditNote = (inv: Invoice) =>
  inv.status === "deleted" && Boolean(String(inv.cancelledInvoice || "").trim());

const getInvoiceRowToneClassName = (inv: Invoice) => {
  if (isCancelledByCreditNote(inv)) {
    return "bg-orange-50/80 hover:bg-orange-100/70";
  }
  if (isCreditNoteInvoice(inv)) {
    return "bg-amber-50/80 hover:bg-amber-100/70";
  }
  if (inv.status === "deleted") {
    return "bg-rose-50/70 hover:bg-rose-100/60";
  }
  if (inv.status === "paid") {
    return "bg-emerald-50/55 hover:bg-emerald-100/45";
  }
  return "hover:bg-slate-50/60";
};

type SortField = "invoiceNumber" | "insurance" | "date" | "amount";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "pending" | "paid" | "deleted";
type MultiStatusFilter = Exclude<StatusFilter, "all">;

const parseInvoiceDate = (value: string): Date | null => {
  if (!value) return null;
  const parsed = parse(value, 'dd/MM/yyyy', new Date());
  if (!isValid(parsed)) return null;
  return parsed;
};

export const Invoices: React.FC = () => {
  const location = useLocation();
  const { appData } = useAppData();
  const { token } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<MultiStatusFilter[]>([]);
  const [filterInsurances, setFilterInsurances] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(subMonths(new Date(), 1)));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => new Date());
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  const [draftFilterStatuses, setDraftFilterStatuses] = useState<MultiStatusFilter[]>([]);
  const [draftFilterInsurances, setDraftFilterInsurances] = useState<string[]>([]);
  const [draftDateFrom, setDraftDateFrom] = useState<Date | undefined>(() => startOfMonth(subMonths(new Date(), 1)));
  const [draftDateTo, setDraftDateTo] = useState<Date | undefined>(() => new Date());
  const [isDateFromPopoverOpen, setIsDateFromPopoverOpen] = useState(false);
  const [isDateToPopoverOpen, setIsDateToPopoverOpen] = useState(false);
  const [insuranceSearchTerm, setInsuranceSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Sorting State
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkActionType>(null);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [loadingEditInvoiceId, setLoadingEditInvoiceId] = useState<string | null>(null);
  const [loadingDetailInvoiceId, setLoadingDetailInvoiceId] = useState<string | null>(null);

  // Hydrate from already-fetched init data (login load) to avoid extra backend fetches on route changes.
  useEffect(() => {
    if (!appData?.resumenFactura) return;
    setInvoices(mapResumenFacturaToInvoices(appData.resumenFactura));
  }, [appData?.resumenFactura]);

  // --- NAVIGATION EFFECT ---
  useEffect(() => {
    const invoiceId = (location.state as { invoiceId?: string })?.invoiceId;
    if (invoiceId) {
      const found = invoices.find((i) => i.id === invoiceId);
      if (found) {
        setSelectedInvoice(found);
      }
    }
  }, [location.state, invoices]);

  const handleCloseDetail = (open: boolean) => {
    if (!open) {
      setSelectedInvoice(null);
    }
  };

  // --- SELECTION LOGIC ---
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedInvoices.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = processedInvoices.map((inv) => inv.id);
      setSelectedIds(new Set(allIds));
    }
  };

  // --- BULK ACTIONS ---
  const getBulkActionTargetStatus = (action: Exclude<BulkActionType, null>): Invoice["status"] => {
    if (action === "pay") return "paid";
    if (action === "delete") return "deleted";
    return "pending";
  };

  const handleBulkActionConfirm = async () => {
    if (!bulkAction) return;

    if (!token) {
      alert("Tu sesion expiro. Volve a iniciar sesion para cobrar facturas.");
      return;
    }

    const invoicesToUpdate = selectedInvoicesForAction;
    if (invoicesToUpdate.length === 0) {
      setBulkAction(null);
      return;
    }

    const targetStatus = getBulkActionTargetStatus(bulkAction);

    try {
      setIsApplyingFilters(true);

      await Promise.all(
        invoicesToUpdate.map(async (inv) => {
          const response = await fetch('/api/invoices', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              id: inv.id,
              status: targetStatus,
            }),
          });

          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.error || `No se pudo actualizar el estado del comprobante ${inv.invoiceNumber}`);
          }
        }),
      );

      setSelectedIds(new Set());
      setBulkAction(null);

      // Refresca contra backend respetando los filtros activos actuales.
      await applyFiltersWithValues(filterStatuses, filterInsurances, dateFrom, dateTo, {
        withLoading: false,
        closeMenu: false,
      });
    } catch (error: any) {
      console.error('Bulk action error:', error);
      alert(error?.message || 'No se pudo actualizar el estado de las facturas seleccionadas.');
    } finally {
      setIsApplyingFilters(false);
    }
  };

  // --- ADD INVOICE HANDLER ---
  const handleSaveInvoice = async (newInvoiceData: any): Promise<boolean> => {
    if (!token) {
      alert("Tu sesion expiro. Volve a iniciar sesion para guardar cambios.");
      return false;
    }

    try {
      const isEditing = Boolean(editingInvoice);
      const response = await fetch('/api/invoices', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingInvoice?.id,
          invoice: {
            ...newInvoiceData,
            status: editingInvoice?.status || 'pending',
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.invoice) {
        throw new Error(payload?.error || 'No se pudo guardar la factura');
      }

      const savedInvoice = mapResumenFacturaToInvoices([payload.invoice])[0];

      if (isEditing) {
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === savedInvoice.id ? savedInvoice : inv)),
        );
        setSelectedInvoice((prev) => (prev?.id === savedInvoice.id ? savedInvoice : prev));
      } else {
        setInvoices((prev) => [savedInvoice, ...prev]);
      }

      return true;
    } catch (error: any) {
      console.error('Save invoice error:', error);
      alert(error?.message || 'No se pudo guardar la factura.');
      return false;
    }
  };

  const hydrateInvoiceAttachment = async (inv: Invoice): Promise<Invoice> => {
    if (!token || inv.fileDataUrl) {
      return inv;
    }

    const response = await fetch(`/api/invoices?id=${encodeURIComponent(inv.id)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok || !payload?.success || !payload?.invoice) {
      throw new Error(payload?.error || 'No se pudo cargar el adjunto de la factura');
    }

    const hydrated = mapResumenFacturaToInvoices([payload.invoice])[0] || inv;
    const invoiceWithAttachment = {
      ...inv,
      ...hydrated,
    };

    setInvoices((prev) => prev.map((item) => (item.id === inv.id ? invoiceWithAttachment : item)));
    return invoiceWithAttachment;
  };

  const handleEditInvoice = async (inv: Invoice) => {
    if (loadingEditInvoiceId === inv.id) return;

    if (!token) {
      alert("Tu sesion expiro. Volve a iniciar sesion.");
      return;
    }

    try {
      setLoadingEditInvoiceId(inv.id);

      const invoiceForEdit = await hydrateInvoiceAttachment(inv);
      setEditingInvoice(invoiceForEdit);
      setIsAddModalOpen(true);
    } catch (error: any) {
      console.error('Load invoice attachment error:', error);
      // Abrimos igual el modal aunque falle el fallback para no bloquear la edición.
      setEditingInvoice(inv);
      setIsAddModalOpen(true);
    } finally {
      setLoadingEditInvoiceId(null);
    }
  };

  const handleOpenInvoiceDetail = async (inv: Invoice) => {
    if (loadingDetailInvoiceId === inv.id) return;

    setSelectedInvoice(inv);

    if (!token || inv.fileDataUrl) {
      return;
    }

    try {
      setLoadingDetailInvoiceId(inv.id);
      const invoiceForDetail = await hydrateInvoiceAttachment(inv);
      setSelectedInvoice(invoiceForDetail);
    } catch (error) {
      console.error('Load detail attachment error:', error);
    } finally {
      setLoadingDetailInvoiceId(null);
    }
  };

  // --- FILTER & SORT LOGIC ---
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const statusFilterOptions: Array<{ label: string; value: MultiStatusFilter }> = [
    { label: 'Pendientes', value: 'pending' },
    { label: 'Cobradas', value: 'paid' },
    { label: 'Anuladas', value: 'deleted' },
  ];

  const insuranceFilterOptions = useMemo(() => {
    const unique = Array.from(new Set(invoices.map((inv) => (inv.insurance || '').trim()).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique.map((item) => ({ label: item, value: item }));
  }, [invoices]);

  const statusLabelByValue = useMemo(
    () => Object.fromEntries(statusFilterOptions.map((option) => [option.value, option.label])) as Record<MultiStatusFilter, string>,
    [statusFilterOptions],
  );

  const statusToneByValue: Record<MultiStatusFilter, string> = {
    pending: 'border-amber-200 text-amber-700 bg-amber-50',
    paid: 'border-emerald-200 text-emerald-700 bg-emerald-50',
    deleted: 'border-slate-200 text-slate-600 bg-slate-50',
  };

  const filteredInsuranceOptions = useMemo(() => {
    const query = insuranceSearchTerm.trim().toLowerCase();
    if (!query) return insuranceFilterOptions;
    return insuranceFilterOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [insuranceFilterOptions, insuranceSearchTerm]);

  const toggleDraftStatus = (statusValue: MultiStatusFilter) => {
    setDraftFilterStatuses((prev) =>
      prev.includes(statusValue) ? prev.filter((item) => item !== statusValue) : [...prev, statusValue],
    );
  };

  const toggleDraftInsurance = (insuranceValue: string) => {
    setDraftFilterInsurances((prev) =>
      prev.includes(insuranceValue) ? prev.filter((item) => item !== insuranceValue) : [...prev, insuranceValue],
    );
  };

  const openFiltersDialog = () => {
    setDraftFilterStatuses(filterStatuses);
    setDraftFilterInsurances(filterInsurances);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setInsuranceSearchTerm("");
  };

  const clearFilters = async () => {
    const defaultFrom = startOfMonth(subMonths(new Date(), 1));
    const defaultTo = new Date();

    setFilterStatuses([]);
    setFilterInsurances([]);
    setDateFrom(defaultFrom);
    setDateTo(defaultTo);

    setDraftFilterStatuses([]);
    setDraftFilterInsurances([]);
    setDraftDateFrom(defaultFrom);
    setDraftDateTo(defaultTo);
    setInsuranceSearchTerm("");

    await applyFiltersWithValues([], [], defaultFrom, defaultTo);
  };

  const applyFiltersWithValues = async (
    statuses: MultiStatusFilter[],
    insurances: string[],
    from: Date | undefined,
    to: Date | undefined,
    options?: {
      withLoading?: boolean;
      closeMenu?: boolean;
    }
  ) => {
    const withLoading = options?.withLoading ?? true;
    const closeMenu = options?.closeMenu ?? true;

    if (!token) {
      if (closeMenu) setIsFilterMenuOpen(false);
      return;
    }

    try {
      if (withLoading) {
        setIsApplyingFilters(true);
      }

      const params = new URLSearchParams();
      if (statuses.length > 0) params.set('status', statuses.join(','));
      if (insurances.length > 0) params.set('insurance', insurances.join(','));
      if (from) params.set('from', format(from, 'yyyy-MM-dd'));
      if (to) params.set('to', format(to, 'yyyy-MM-dd'));

      const response = await fetch(`/api/invoices?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success || !Array.isArray(payload?.invoices)) {
        throw new Error(payload?.error || 'No se pudieron actualizar los filtros');
      }

      setInvoices(mapResumenFacturaToInvoices(payload.invoices));
      setSelectedIds(new Set());
      if (closeMenu) {
        setIsFilterMenuOpen(false);
      }
    } catch (error: any) {
      console.error('Filter fetch error:', error);
      alert(error?.message || 'No se pudo aplicar el filtro.');
    } finally {
      if (withLoading) {
        setIsApplyingFilters(false);
      }
    }
  };

  const applyFilters = async () => {
    let normalizedFrom = draftDateFrom ? startOfDay(draftDateFrom) : undefined;
    let normalizedTo = draftDateTo ? endOfDay(draftDateTo) : undefined;

    if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
      const safeFrom = startOfDay(normalizedTo);
      const safeTo = endOfDay(normalizedFrom);
      normalizedFrom = safeFrom;
      normalizedTo = safeTo;
    }

    setFilterStatuses(draftFilterStatuses);
    setFilterInsurances(draftFilterInsurances);
    setDateFrom(normalizedFrom);
    setDateTo(normalizedTo);

    await applyFiltersWithValues(draftFilterStatuses, draftFilterInsurances, normalizedFrom, normalizedTo);
  };

  const activeFilterCount = [
    filterStatuses.length > 0,
    filterInsurances.length > 0,
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const processedInvoices = useMemo(() => {
    // 1. Filter
    let result = invoices.filter((inv) => {
      const matchesStatus =
        filterStatuses.length === 0 || filterStatuses.includes(inv.status as MultiStatusFilter);
      const matchesInsurance =
        filterInsurances.length === 0 || filterInsurances.includes(inv.insurance);

      const parsedInvoiceDate = parseInvoiceDate(inv.date);
      const matchesFrom = !dateFrom || (parsedInvoiceDate ? parsedInvoiceDate >= startOfDay(dateFrom) : false);
      const matchesTo = !dateTo || (parsedInvoiceDate ? parsedInvoiceDate <= endOfDay(dateTo) : false);

      const term = searchTerm.toLowerCase();

      const matchesSearch =
        inv.insurance.toLowerCase().includes(term) ||
        inv.licensePlate.toLowerCase().includes(term) ||
        inv.invoiceNumber.includes(term) ||
        inv.type.toLowerCase().includes(term) ||
        inv.date.includes(term) ||
        inv.siniestro.toLowerCase().includes(term) ||
        inv.description.toLowerCase().includes(term) ||
        (inv.cancelledInvoice && inv.cancelledInvoice.toLowerCase().includes(term));

      return matchesStatus && matchesInsurance && matchesFrom && matchesTo && matchesSearch;
    });

    // 2. Sort
    result.sort((a, b) => {
      let comparison = 0;

      if (sortField === "invoiceNumber") {
        comparison = a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, {
          numeric: true,
        });
      } else if (sortField === "insurance") {
        comparison = a.insurance.localeCompare(b.insurance);
      } else if (sortField === "date") {
        const dateA = a.date.split("/").reverse().join("");
        const dateB = b.date.split("/").reverse().join("");
        comparison = dateA.localeCompare(dateB);
      } else if (sortField === "amount") {
        comparison = a.amount - b.amount;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [invoices, filterStatuses, filterInsurances, dateFrom, dateTo, searchTerm, sortField, sortDirection]);

  // --- TOTALS CALCULATION ---
  const totals = useMemo(() => {
    const validInvoices = processedInvoices.filter(
      (i) => i.status !== "deleted",
    );
    let total = 0;
    let subtotal = 0;
    let vat = 0;

    validInvoices.forEach((curr) => {
      total += curr.amount;
      if (curr.type.includes("Exenta")) {
        subtotal += curr.amount;
      } else {
        const net = curr.amount / 1.21;
        subtotal += net;
        vat += curr.amount - net;
      }
    });

    return { total, subtotal, vat };
  }, [processedInvoices]);

  const selectionTotals = useMemo(() => {
    let pendingCount = 0;
    let revertableCount = 0;

    selectedIds.forEach((id) => {
      const inv = invoices.find((i) => i.id === id);
      if (inv) {
        if (inv.status === "pending") pendingCount++;
        if (inv.status === "paid" || inv.status === "deleted")
          revertableCount++;
      }
    });
    return { pendingCount, revertableCount };
  }, [selectedIds, invoices]);

  // --- EXCEL EXPORT ---
  const handleExportExcel = () => {
    const normalizedDataToExport = processedInvoices.map((inv) => ({
      Fecha: inv.date,
      Tipo: inv.type,
      Numero: inv.invoiceNumber,
      Seguro: inv.insurance,
      Patente: inv.licensePlate,
      Descripcion: inv.description,
      Siniestro: inv.siniestro,
      'Comprobante Cancelado': inv.cancelledInvoice || '',
      Estado:
        inv.status === "paid"
          ? "Cobrada"
          : inv.status === "pending"
            ? "Pendiente"
            : "Anulada",
      Subtotal: inv.type.includes("Exenta") ? inv.amount : inv.amount / 1.21,
      IVA: inv.type.includes("Exenta") ? 0 : inv.amount - inv.amount / 1.21,
      Total: inv.amount,
    }));

    normalizedDataToExport.push({
      Fecha: '',
      Tipo: '',
      Numero: '',
      Seguro: '',
      Patente: '',
      Descripcion: 'TOTAL',
      Siniestro: '',
      'Comprobante Cancelado': '',
      Estado: '',
      Subtotal: totals.subtotal,
      IVA: totals.vat,
      Total: totals.total,
    });

    const worksheet = XLSX.utils.json_to_sheet(normalizedDataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturacion");
    XLSX.writeFile(
      workbook,
      `Reporte_Facturacion_${new Date().toLocaleDateString().replace(/\//g, "-")}.xlsx`,
    );
  };

  // --- RENDER HELPERS ---
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge
            variant="success"
            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 px-2.5 py-0.5 text-[11px] font-semibold rounded-full"
          >
            Cobrada
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60 px-2.5 py-0.5 text-[11px] font-semibold rounded-full"
          >
            Pendiente
          </Badge>
        );
      case "overdue":
        return (
          <Badge
            variant="destructive"
            className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60 px-2.5 py-0.5 text-[11px] font-semibold rounded-full"
          >
            Vencida
          </Badge>
        );
      case "deleted":
        return (
          <Badge
            variant="outline"
            className="text-slate-500 border-slate-200/60 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold rounded-full"
          >
            Anulada
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-[11px]"
          >
            {status}
          </Badge>
        );
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 text-gray-300 ml-1 opacity-50" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 text-gray-700 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-gray-700 ml-1" />
    );
  };

  // Filtrar facturas seleccionadas para el modal
  const selectedInvoicesForAction = useMemo(() => {
    if (!bulkAction) return [];
    return invoices.filter((inv) => {
      if (!selectedIds.has(inv.id)) return false;
      if (bulkAction === "pay" && inv.status === "pending") return true;
      if (bulkAction === "delete" && inv.status === "pending") return true;
      if (
        bulkAction === "revert" &&
        (inv.status === "paid" || inv.status === "deleted")
      )
        return true;
      return false;
    });
  }, [invoices, selectedIds, bulkAction]);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-2rem)] gap-4 relative">
      {/* 1. Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap xl:flex-nowrap gap-4 items-center justify-between flex-none transition-all duration-300">
        <div className="flex items-center gap-4 w-full xl:w-auto flex-1 min-w-0">
          <div className="hidden xl:block pr-6 border-r border-slate-100 flex-none">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
              Facturación
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">
              Gestión de comprobantes
            </p>
          </div>

          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
            <div className="relative w-full xl:w-[320px] group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
              <Input
                placeholder="Buscar comprobante, patente, cliente..."
                className="pl-9 bg-slate-50/50 border-slate-200/60 focus:bg-white h-10 text-sm w-full rounded-xl transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-end flex-shrink-0">
          <div className="bg-slate-100/80 p-1 rounded-xl flex flex-none border border-slate-200/50">
            {["all", "pending", "paid", "deleted"].map((status) => {
              const isActive =
                status === "all"
                  ? filterStatuses.length === 0
                  : filterStatuses.length === 1 && filterStatuses[0] === status;

              return (
              <button
                key={status}
                onClick={() => {
                  const nextStatuses = status === "all" ? [] : [status as MultiStatusFilter];
                  setFilterStatuses(nextStatuses);
                  setDraftFilterStatuses(nextStatuses);
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 capitalize",
                  isActive
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50",
                )}
              >
                {status === "all"
                  ? "Todos"
                  : status === "pending"
                    ? "Pendientes"
                    : status === "paid"
                      ? "Cobradas"
                      : "Anuladas"}
              </button>
            )})}
          </div>

          <div className="h-8 w-px bg-slate-200 hidden xl:block mx-1"></div>

          <div className="flex gap-2 flex-none">
            <Popover.Root
              open={isFilterMenuOpen}
              onOpenChange={(open) => {
                if (open) {
                  openFiltersDialog();
                }
                setIsFilterMenuOpen(open);
              }}
            >
              <Popover.Trigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl font-medium"
                >
                  <Filter className="w-4 h-4 mr-2 text-slate-500" /> Filtros
                  {activeFilterCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="bottom"
                  align="end"
                  sideOffset={-40}
                  onInteractOutside={(event) => {
                    const target = event.target as HTMLElement | null;
                    if (target?.closest('[data-filter-submenu="true"]')) {
                      event.preventDefault();
                    }
                  }}
                  className="z-[9999] w-[320px] bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                >
                  <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-700">Filtros</span>
                    </div>
                    <button
                      className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setIsFilterMenuOpen(false)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Filtros Activos</p>
                      <div className="mt-2 flex flex-wrap gap-2 min-h-[26px]">
                        {draftFilterStatuses.map((status) => (
                          <button
                            key={`chip-status-${status}`}
                            type="button"
                            onClick={() => toggleDraftStatus(status)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors",
                              statusToneByValue[status],
                            )}
                          >
                            {statusLabelByValue[status]}
                            <X className="h-3 w-3" />
                          </button>
                        ))}
                        {draftFilterInsurances.slice(0, 2).map((insurance) => (
                          <button
                            key={`chip-insurance-${insurance}`}
                            type="button"
                            onClick={() => toggleDraftInsurance(insurance)}
                            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 transition-colors"
                          >
                            {insurance}
                            <X className="h-3 w-3" />
                          </button>
                        ))}
                        {draftFilterInsurances.length > 2 && (
                          <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50/70 px-2 py-1 text-[11px] font-semibold text-sky-700">
                            +{draftFilterInsurances.length - 2} seguros
                          </span>
                        )}
                        {draftFilterStatuses.length === 0 && draftFilterInsurances.length === 0 && (
                          <span className="text-[11px] font-medium text-slate-500">Sin filtros por estado o seguro.</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">Desde</label>
                        <Popover.Root open={isDateFromPopoverOpen} onOpenChange={setIsDateFromPopoverOpen}>
                          <Popover.Trigger asChild>
                            <Button
                              variant="outline"
                              className="h-9 w-full justify-start text-left font-normal bg-white hover:bg-slate-50 border-slate-200/80 shadow-sm text-sm px-3"
                            >
                              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                              <span className={cn("truncate", !draftDateFrom && "text-slate-400")}>
                                {draftDateFrom ? format(draftDateFrom, 'dd/MM/yyyy') : 'Fecha'}
                              </span>
                            </Button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content data-filter-submenu="true" className="w-auto p-0 bg-white rounded-xl border border-slate-200 shadow-xl z-[9999]" align="start">
                              <Calendar
                                mode="single"
                                selected={draftDateFrom}
                                onSelect={(date) => {
                                  setDraftDateFrom(date);
                                  setIsDateFromPopoverOpen(false);
                                }}
                              />
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">Hasta</label>
                        <Popover.Root open={isDateToPopoverOpen} onOpenChange={setIsDateToPopoverOpen}>
                          <Popover.Trigger asChild>
                            <Button
                              variant="outline"
                              className="h-9 w-full justify-start text-left font-normal bg-white hover:bg-slate-50 border-slate-200/80 shadow-sm text-sm px-3"
                            >
                              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                              <span className={cn("truncate", !draftDateTo && "text-slate-400")}>
                                {draftDateTo ? format(draftDateTo, 'dd/MM/yyyy') : 'Fecha'}
                              </span>
                            </Button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content data-filter-submenu="true" className="w-auto p-0 bg-white rounded-xl border border-slate-200 shadow-xl z-[9999]" align="start">
                              <Calendar
                                mode="single"
                                selected={draftDateTo}
                                onSelect={(date) => {
                                  setDraftDateTo(date);
                                  setIsDateToPopoverOpen(false);
                                }}
                              />
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-500">Estado</label>
                        <button
                          type="button"
                          onClick={() => setDraftFilterStatuses([])}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Todos
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {statusFilterOptions.map((option) => {
                          const isSelected = draftFilterStatuses.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => toggleDraftStatus(option.value)}
                              className={cn(
                                "h-9 rounded-lg border text-xs font-semibold transition-all",
                                isSelected
                                  ? statusToneByValue[option.value]
                                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-500">Seguro</label>
                        <button
                          type="button"
                          onClick={() => setDraftFilterInsurances([])}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Limpiar
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={insuranceSearchTerm}
                          onChange={(event) => setInsuranceSearchTerm(event.target.value)}
                          placeholder="Buscar seguro..."
                          className="h-9 rounded-lg border-slate-200 pl-8 text-sm"
                        />
                      </div>

                      <div className="max-h-[168px] overflow-y-auto custom-scrollbar rounded-lg border border-slate-200 bg-white p-1">
                        <button
                          type="button"
                          onClick={() => setDraftFilterInsurances([])}
                          className="relative flex w-full items-center rounded-md px-2 py-1.5 text-sm text-left text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Check className={cn('mr-2 h-4 w-4 text-emerald-600', draftFilterInsurances.length === 0 ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">Todos</span>
                        </button>
                        {filteredInsuranceOptions.length === 0 && (
                          <div className="px-2 py-3 text-xs text-slate-500">No hay coincidencias para tu búsqueda.</div>
                        )}
                        {filteredInsuranceOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleDraftInsurance(option.value)}
                            className={cn(
                              "relative flex w-full items-center rounded-md px-2 py-1.5 text-sm text-left transition-colors",
                              draftFilterInsurances.includes(option.value)
                                ? "bg-emerald-50 text-emerald-800"
                                : "text-slate-700 hover:bg-slate-100",
                            )}
                          >
                            <Check className={cn('mr-2 h-4 w-4 text-emerald-600', draftFilterInsurances.includes(option.value) ? 'opacity-100' : 'opacity-0')} />
                            <span className="truncate">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex items-center justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      onClick={clearFilters}
                      className="h-9 px-4 text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 text-sm font-medium"
                    >
                      Limpiar
                    </Button>
                    <Button
                      onClick={applyFilters}
                      isLoading={isApplyingFilters}
                      className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 text-sm font-medium"
                    >
                      Aplicar
                    </Button>
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <Button
              variant="outline"
              size="sm"
              className="h-10 hidden sm:flex text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl font-medium"
              onClick={handleExportExcel}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />{" "}
              Excel
            </Button>
            <Button
              size="sm"
              className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 px-4 rounded-xl font-medium"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Nueva Factura
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Main Table Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col min-h-0 relative transition-all">
        {/* INLINE SELECTION BAR */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-50 border-b border-emerald-100 overflow-hidden"
            >
              <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    {selectedIds.size}
                  </div>
                  <span className="text-sm font-medium text-emerald-900">seleccionadas</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {selectionTotals.pendingCount > 0 && (
                    <>
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs rounded-lg font-medium px-4"
                        onClick={() => setBulkAction("pay")}
                      >
                        <CheckCircle className="w-4 h-4 mr-1.5" /> Cobrar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 text-xs rounded-lg bg-white px-4"
                        onClick={() => setBulkAction("delete")}
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" /> Anular
                      </Button>
                    </>
                  )}
                  {selectionTotals.revertableCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 text-xs rounded-lg bg-white px-4"
                      onClick={() => setBulkAction("revert")}
                    >
                      <Undo2 className="w-4 h-4 mr-1.5" /> Revertir
                    </Button>
                  )}
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="ml-2 p-1.5 text-emerald-600/60 hover:text-emerald-700 hover:bg-emerald-100/50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 z-10">
              <tr className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5 w-[40px] text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="focus:outline-none hover:text-slate-700 transition-colors"
                  >
                    {selectedIds.size > 0 &&
                    selectedIds.size === processedInvoices.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </button>
                </th>

                <th className="py-3 px-4 w-[120px]">Estado</th>
                <th
                  className="py-3 px-4 w-[140px] cursor-pointer hover:text-slate-800 transition-colors group"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    Fecha <SortIcon field="date" />
                  </div>
                </th>
                <th
                  className="py-3 px-4 w-[140px] cursor-pointer hover:text-slate-800 transition-colors group"
                  onClick={() => handleSort("invoiceNumber")}
                >
                  <div className="flex items-center gap-1">
                    Comprobante <SortIcon field="invoiceNumber" />
                  </div>
                </th>
                <th className="py-3 px-4 w-[200px]">Tipo</th>
                <th
                  className="py-3 px-4 min-w-[200px] cursor-pointer hover:text-slate-800 transition-colors group"
                  onClick={() => handleSort("insurance")}
                >
                  <div className="flex items-center gap-1">
                    Seguro / Patente <SortIcon field="insurance" />
                  </div>
                </th>
                <th className="py-3 px-4 w-auto">Descripción</th>
                <th
                  className="py-3 px-5 text-right w-[140px] cursor-pointer hover:text-slate-800 transition-colors group"
                  onClick={() => handleSort("amount")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Monto <SortIcon field="amount" />
                  </div>
                </th>
                <th className="py-3 px-5 w-[100px] text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              <AnimatePresence initial={false}>
                {processedInvoices.map((inv, index) => {
                  const isSelected = selectedIds.has(inv.id);
                  const toneClassName = getInvoiceRowToneClassName(inv);
                  return (
                    <motion.tr
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{
                        duration: 0.2,
                        delay: Math.min(index * 0.02, 0.2),
                      }}
                      key={inv.id}
                      onClick={() => toggleSelection(inv.id)}
                      className={cn(
                        "transition-colors group cursor-pointer",
                        isSelected
                          ? "bg-emerald-50/40"
                          : toneClassName,
                        selectedInvoice?.id === inv.id &&
                          !isSelected &&
                          "bg-slate-50",
                      )}
                    >
                      <td
                        className="py-3 px-5 align-middle text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => toggleSelection(inv.id)}
                          className="focus:outline-none"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <span className="font-mono text-slate-600 text-xs font-medium block">
                          {inv.date}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <span className="font-mono font-semibold text-slate-800 text-xs">
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 uppercase tracking-wide">
                          {inv.type.replace("Factura ", "")}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-col">
                          <span
                            className="font-semibold text-slate-900 text-xs truncate max-w-[220px]"
                            title={inv.insurance}
                          >
                            {inv.insurance}
                          </span>
                          {inv.licensePlate !== "-" && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono bg-slate-100/80 px-1.5 py-0.5 rounded-md w-fit border border-slate-200/50">
                              {inv.licensePlate}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-col max-w-[300px]">
                          <span
                            className="text-slate-700 text-xs truncate font-medium"
                            title={inv.description}
                          >
                            {inv.description || "Sin descripción"}
                          </span>
                          {inv.siniestro && (
                            <span className="text-[10px] text-slate-400 mt-0.5 truncate font-medium">
                              Ref: {inv.siniestro}
                            </span>
                          )}
                          {inv.cancelledInvoice && (
                            <span className="text-[10px] text-orange-500 mt-0.5 truncate font-medium">
                              Anula: {inv.cancelledInvoice}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-5 align-middle text-right">
                        <span
                          className={cn(
                            "font-mono font-semibold text-sm block tracking-tight",
                            inv.status === "paid"
                              ? "text-emerald-700"
                              : "text-slate-900",
                          )}
                        >
                          {formatCurrency(inv.amount)}
                        </span>
                      </td>
                      <td
                        className="py-3 px-5 align-middle text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            onClick={() => handleEditInvoice(inv)}
                            title="Editar Factura"
                            disabled={loadingEditInvoiceId === inv.id}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            onClick={() => handleOpenInvoiceDetail(inv)}
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {processedInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-24">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <Search className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-600">
                        No se encontraron comprobantes
                      </p>
                      <p className="text-sm mt-1">
                        Intenta cambiar los filtros de búsqueda
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Footer Totals - REDESIGNED */}
        <div className="bg-white border-t border-slate-200/60 p-4 z-20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-slate-500 font-medium text-xs">
              Mostrando{" "}
              <span className="text-slate-900 font-bold">
                {processedInvoices.length}
              </span>{" "}
              operaciones
            </div>

            <div className="flex items-center gap-0 bg-slate-50/80 rounded-2xl p-1.5 border border-slate-200/60">
              {/* Subtotal */}
              <div className="px-5 py-1.5 border-r border-slate-200/60 flex flex-col items-end">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                  Subtotal
                </span>
                <span className="font-mono font-semibold text-slate-700 text-sm">
                  {formatCurrency(totals.subtotal)}
                </span>
              </div>

              {/* IVA */}
              <div className="px-5 py-1.5 flex flex-col items-end">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                  IVA (21%)
                </span>
                <span className="font-mono font-semibold text-slate-700 text-sm">
                  {formatCurrency(totals.vat)}
                </span>
              </div>

              {/* Total Final Highlighted */}
              <div className="bg-slate-900 text-white px-6 py-2.5 rounded-xl shadow-sm ml-2 flex flex-col items-end min-w-[150px] relative overflow-hidden group">
                <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider relative z-10">
                  Total Final
                </span>
                <span className="font-mono font-bold text-lg relative z-10 tracking-tight">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- CONFIRMATION MODAL (REFACTORED) --- */}
      <BulkActionModal
        action={bulkAction}
        onOpenChange={(open) => !open && setBulkAction(null)}
        onConfirm={handleBulkActionConfirm}
        selectedInvoices={selectedInvoicesForAction}
      />

      {/* --- MODALS --- */}
      <InvoiceFormModal
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) setEditingInvoice(null);
        }}
        onSave={handleSaveInvoice}
        initialData={editingInvoice}
      />

      <InvoiceDetailModal
        invoice={selectedInvoice}
        onClose={() => handleCloseDetail(false)}
        onStatusChange={(id, newStatus) => {
          setInvoices((prev) =>
            prev.map((inv) =>
              inv.id === id ? { ...inv, status: newStatus } : inv,
            ),
          );
          setSelectedInvoice((prev) =>
            prev ? { ...prev, status: newStatus } : null,
          );
          if (newStatus === "deleted") {
            setSelectedInvoice(null);
          }
        }}
      />

      {(loadingEditInvoiceId || loadingDetailInvoiceId || isApplyingFilters) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-200">
          <div className="bg-white/95 p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[260px] w-full mx-4 border border-white/20">
            <Loader2 className="w-8 h-8 text-[#113123] animate-spin mb-3" />
            <h2 className="text-[#113123] text-lg font-bold mb-1 tracking-tight">
              {isApplyingFilters ? "Aplicando filtros..." : "Cargando factura..."}
            </h2>
            <p className="text-gray-600 text-[11px] text-center leading-relaxed">
              {isApplyingFilters 
                ? "Buscando información actualizada." 
                : "Estamos trayendo los datos y adjuntos para ver o editar."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
