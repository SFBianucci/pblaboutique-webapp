import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Dialog } from "../components/ui/Dialog";
import { Badge } from "../components/ui/Badge";
import { Invoice } from "../types";
import { cn, formatCurrency } from "../lib/utils";
import { InvoiceFormModal } from "../components/InvoiceFormModal";
import { BulkActionModal, BulkActionType } from "../components/BulkActionModal";
import { InvoiceDetailModal } from "../components/InvoiceDetailModal";
// @ts-ignore
import * as XLSX from "xlsx";

// --- CONSTANTS & MOCKS ---
const MOCKS_INVOICES_DATA: Invoice[] = [
  {
    id: "1",
    date: "14/01/2026",
    insurance: "FEDERACION PATRONAL",
    invoiceNumber: "10408",
    licensePlate: "IWR488",
    type: "Factura A",
    amount: 282009.0,
    status: "pending",
    description: "Cambio Parabrisas",
    siniestro: "",
  },
  {
    id: "2",
    date: "14/01/2026",
    insurance: "PARTICULAR",
    invoiceNumber: "10407",
    licensePlate: "-",
    type: "Factura A",
    amount: 1359357.56,
    status: "deleted",
    description: "Reparación Integral",
    siniestro: "SIN-001",
  },
  {
    id: "3",
    date: "13/01/2026",
    insurance: "PARTICULAR",
    invoiceNumber: "10406",
    licensePlate: "AA008KN",
    type: "Factura A",
    amount: 260000.0,
    status: "pending",
    description: "Espejo Lateral",
    siniestro: "",
  },
  {
    id: "4",
    date: "13/01/2026",
    insurance: "EXPERTA SEGUROS",
    invoiceNumber: "10405",
    licensePlate: "AC813AH",
    type: "Nota de Credito - Factura A",
    amount: -665500.0,
    status: "paid",
    description: "Anula Factura 10400",
    siniestro: "EXP-992",
    cancelledInvoice: "10400"
  },
  {
    id: "5",
    date: "13/01/2026",
    insurance: "SAN CRISTOBAL",
    invoiceNumber: "10404",
    licensePlate: "KME678",
    type: "Factura A",
    amount: 1185800.0,
    status: "pending",
    description: "Parabrisas + Burlete",
    siniestro: "55221",
  },
  {
    id: "3091",
    date: "30/01/2026",
    insurance: "ARMORAUT",
    invoiceNumber: "10524",
    licensePlate: "AG383VQ",
    amount: 151250.0,
    status: "pending",
    type: "Factura A",
    description: "COLOC KUGA",
    siniestro: "518132",
  },
  {
    id: "3082",
    date: "28/01/2026",
    insurance: "ARMORAUT",
    invoiceNumber: "10513",
    licensePlate: "AH358RH",
    amount: 151250.0,
    status: "pending",
    type: "Factura A",
    description: "COLOC BRONCO",
    siniestro: "518509",
  },
  {
    id: "3081",
    date: "28/01/2026",
    insurance: "ARMORAUT",
    invoiceNumber: "10514",
    licensePlate: "AH016YV",
    amount: 151250.0,
    status: "pending",
    type: "Factura A",
    description: "COLOC RANGER",
    siniestro: "518529",
  },
  {
    id: "2854",
    date: "17/12/2025",
    insurance: "ARMORAUT",
    invoiceNumber: "10286",
    licensePlate: "AH469QJ",
    amount: 145200.0,
    status: "paid",
    type: "Factura A",
    description: "COLOC",
    siniestro: "517452",
  },
];

interface InvoicesProps {
  initialInvoiceId: string | null;
  onClearSelection: () => void;
}

type SortField = "invoiceNumber" | "insurance" | "date" | "amount";
type SortDirection = "asc" | "desc";

export const Invoices: React.FC<InvoicesProps> = ({
  initialInvoiceId,
  onClearSelection,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>(MOCKS_INVOICES_DATA);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "paid" | "deleted"
  >("all");
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

  // --- NAVIGATION EFFECT ---
  useEffect(() => {
    if (initialInvoiceId) {
      const found = invoices.find((i) => i.id === initialInvoiceId);
      if (found) {
        setSelectedInvoice(found);
      }
    }
  }, [initialInvoiceId, invoices]);

  const handleCloseDetail = (open: boolean) => {
    if (!open) {
      setSelectedInvoice(null);
      onClearSelection();
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
  const handleBulkActionConfirm = () => {
    if (!bulkAction) return;

    setInvoices((prev) =>
      prev.map((inv) => {
        if (selectedIds.has(inv.id)) {
          if (bulkAction === "pay" && inv.status === "pending") {
            return { ...inv, status: "paid" };
          }
          if (bulkAction === "delete" && inv.status === "pending") {
            return { ...inv, status: "deleted" };
          }
          if (
            bulkAction === "revert" &&
            (inv.status === "paid" || inv.status === "deleted")
          ) {
            return { ...inv, status: "pending" };
          }
        }
        return inv;
      }),
    );

    setSelectedIds(new Set());
    setBulkAction(null);
  };

  // --- ADD INVOICE HANDLER ---
  const handleSaveInvoice = (newInvoiceData: any) => {
    if (editingInvoice) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === editingInvoice.id
            ? {
                ...inv,
                ...newInvoiceData,
                amount: parseFloat(newInvoiceData.amount) || 0,
              }
            : inv,
        ),
      );
    } else {
      const newInvoice: Invoice = {
        id: Math.random().toString(36).substr(2, 9),
        status: "pending",
        ...newInvoiceData,
        amount: parseFloat(newInvoiceData.amount) || 0,
      };
      setInvoices((prev) => [newInvoice, ...prev]);
    }
  };

  const handleEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setIsAddModalOpen(true);
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

  const processedInvoices = useMemo(() => {
    // 1. Filter
    let result = invoices.filter((inv) => {
      const matchesStatus =
        filterStatus === "all" || inv.status === filterStatus;
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

      return matchesStatus && matchesSearch;
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
  }, [invoices, filterStatus, searchTerm, sortField, sortDirection]);

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
    const dataToExport = processedInvoices.map((inv) => ({
      Fecha: inv.date,
      Tipo: inv.type,
      Numero: inv.invoiceNumber,
      Seguro: inv.insurance,
      Patente: inv.licensePlate,
      Descripcion: inv.description,
      Siniestro: inv.siniestro,
      'Comprobante Cancelado': inv.cancelledInvoice || '',
      'Archivo Adjunto': inv.fileName || '',
      Estado:
        inv.status === "paid"
          ? "Cobrada"
          : inv.status === "pending"
            ? "Pendiente"
            : "Anulada",
      Monto: inv.amount,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
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
            {["all", "pending", "paid", "deleted"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 capitalize",
                  filterStatus === status
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
            ))}
          </div>

          <div className="h-8 w-px bg-slate-200 hidden xl:block mx-1"></div>

          <div className="flex gap-2 flex-none">
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
                  className="py-3 px-4 w-[160px] cursor-pointer hover:text-slate-800 transition-colors group"
                  onClick={() => handleSort("invoiceNumber")}
                >
                  <div className="flex items-center gap-1">
                    Comprobante <SortIcon field="invoiceNumber" />
                  </div>
                </th>
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
                          : "hover:bg-slate-50/60",
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
                        <div className="flex flex-col">
                          <span className="font-mono font-semibold text-slate-800 text-xs">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5">
                            {inv.type.replace("Factura ", "")}
                          </span>
                        </div>
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
                          {inv.fileName && (
                            <span className="text-[10px] text-blue-500 mt-0.5 truncate font-medium flex items-center gap-1">
                              <FileText className="w-3 h-3" /> {inv.fileName}
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
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            onClick={() => setSelectedInvoice(inv)}
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
                  <td colSpan={8} className="text-center py-24">
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
    </div>
  );
};
