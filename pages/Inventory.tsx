import React, { useState, useMemo, useCallback } from "react";
import {
  RefreshCw, Search, FileSpreadsheet, Plus, ClipboardList,
  AlertTriangle, Package, Edit2, Loader2, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Dialog } from "../components/ui/Dialog";
import { useAppData } from "../lib/AppDataContext";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";
// @ts-ignore
import * as XLSX from "xlsx";

/* ── Types ───────────────────────────────────────────────────────── */

interface StockRow {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  descripcion: string;
  cantidad: number;
  concatStock: string;
}

interface CierreItem {
  stockId: string;
  tipo: string;
  articulo: string;
  anterior: number;
  saliente: number;
  resultado: number;
}

interface IngresoTempItem {
  stockId: string;
  tipo: string;
  articulo: string;
  cantIngresada: number;
  stockAnterior: number;
  stockTotal: number;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const normalizeText = (v: string) =>
  String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Acortar nombres largos de tipo para badges/tags */
const shortTipo = (tipo: string) => {
  if (tipo.toLowerCase().includes("ventiletes")) return "Vent/Aletas/Cust";
  return tipo;
};

const mapStockRow = (raw: any): StockRow => ({
  id: String(raw.id),
  tipo: raw.Tipo_ST || raw.Tipo_x0020_ST || "",
  marca: raw.Modelo_ST || raw.Modelo_x0020_ST || "",
  modelo: raw.Articulo_ST || "",
  descripcion: raw.Descripcion_ST || raw.Descripcion_x0020_ST || raw.Descripci_x00f3_n_ST || raw.Descripción_ST || "",
  cantidad: Number(raw.Cantidad_ST ?? raw.Cantidad_x0020_ST ?? 0),
  concatStock: raw.ConcatStock_ST || raw.ConcatStock_x0020_ST || "",
});

const extractName = (item: any): string => {
  const candidates = [
    item.Tipo_TS, item.Tipo_x0020_TS,
    item.Title,
    item.Titulo_TS, item.Nombre_TS,
    item.TipoStock_TS,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.length > 0 && v.toLowerCase() !== "boutique");
  if (found) return found;
  const skip = new Set(["id", "Title", "@odata.etag", "ContentType", "Modified", "Created", "AuthorLookupId", "EditorLookupId", "Attachments", "Edit", "ItemChildCount", "FolderChildCount", "_UIVersionString", "Status_TS", "Status_x0020_TS"]);
  for (const [key, val] of Object.entries(item)) {
    if (skip.has(key)) continue;
    if (typeof val === "string" && val.length > 1 && val.toLowerCase() !== "boutique" && val !== "Activo") return val;
  }
  return "";
};

/* ── Dropdown ────────────────────────────────────────────────────── */

const Dropdown = ({
  value, placeholder, options, onSelect, className,
}: {
  value: string;
  placeholder: string;
  options: { label: string; value: string }[];
  onSelect: (v: string) => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const filtered = search ? options.filter((o) => normalizeText(o.label).includes(normalizeText(search))) : options;

  const handleOpen = () => { setOpen(true); setSearch(""); setTimeout(() => inputRef.current?.focus(), 0); };

  return (
    <div className={cn("relative", className)}>
      <button type="button" onClick={() => open ? setOpen(false) : handleOpen()}
        className="w-full h-10 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm text-left flex items-center justify-between hover:border-slate-300 transition-colors">
        <span className={value ? "text-slate-900 font-medium" : "text-slate-400"}>{value || placeholder}</span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-80 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-slate-100">
              <input ref={inputRef} type="text"
                className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="overflow-y-auto max-h-68">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-400 text-center">Sin resultados</div>
              ) : filtered.map((opt) => (
                <button key={opt.value} type="button"
                  className={cn("w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors",
                    opt.value === value && "bg-emerald-50 text-emerald-800 font-medium")}
                  onClick={() => { onSelect(opt.value); setOpen(false); }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ── MultiSelect ─────────────────────────────────────────────────── */

const MultiSelect = ({
  selected, placeholder, options, onApply, className,
}: {
  selected: string[];
  placeholder: string;
  options: string[];
  onApply: (next: string[]) => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(selected);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const filtered = search ? options.filter((o) => normalizeText(o).includes(normalizeText(search))) : options;

  const label = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} tipos`;
  const isDirty = JSON.stringify(draft.sort()) !== JSON.stringify([...selected].sort());

  const handleOpen = () => { setDraft(selected); setSearch(""); setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); };
  const handleApply = () => { onApply(draft); setOpen(false); };
  const toggleDraft = (v: string) => setDraft((prev) => prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]);

  return (
    <div className={cn("relative", className)}>
      <button type="button" onClick={() => open ? setOpen(false) : handleOpen()}
        className="w-full h-10 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm text-left flex items-center justify-between hover:border-slate-300 transition-colors gap-2">
        <span className={selected.length > 0 ? "text-slate-900 font-medium truncate" : "text-slate-400"}>{label}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onApply([]); }}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-96 overflow-hidden flex flex-col min-w-[200px]">
            <div className="p-2 border-b border-slate-100">
              <input ref={inputRef} type="text"
                className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="overflow-y-auto max-h-60 py-1">
              <button type="button"
                className={cn("w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors",
                  draft.length === 0 && "text-emerald-700")}
                onClick={() => setDraft([])}>
                <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  draft.length === 0 ? "bg-emerald-600 border-emerald-600" : "border-slate-300")}>
                  {draft.length === 0 && <span className="text-white text-[10px] font-bold">✓</span>}
                </div>
                Todos
              </button>
              <div className="h-px bg-slate-100 mx-2 my-1" />
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-400 text-center">Sin resultados</div>
              ) : filtered.map((opt) => {
                const isSelected = draft.includes(opt);
                return (
                  <button key={opt} type="button"
                    className={cn("w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors",
                      isSelected && "text-emerald-700")}
                    onClick={() => toggleDraft(opt)}>
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isSelected ? "bg-emerald-600 border-emerald-600" : "border-slate-300")}>
                      {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    {opt}
                  </button>
                );
              })}
            </div>
            {/* Apply button */}
            <div className="p-2 border-t border-slate-100">
              <button type="button" onClick={handleApply}
                className={cn("w-full h-8 rounded-lg text-xs font-medium transition-colors",
                  isDirty ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-100 text-slate-400")}>
                Aplicar{draft.length > 0 ? ` (${draft.length})` : ""}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ── Component ───────────────────────────────────────────────────── */

export const Inventory: React.FC = () => {
  const { appData } = useAppData();
  const { token } = useAuth();

  const [allStock, setAllStock] = useState<StockRow[]>([]);
  const [allSalida, setAllSalida] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [sortFields, setSortFields] = useState<{ field: "marca" | "tipo"; dir: "asc" | "desc" }[]>([{ field: "marca", dir: "asc" }]);

  // Modals
  const [editItem, setEditItem] = useState<StockRow | null>(null);
  const [editQty, setEditQty] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isIngresoOpen, setIsIngresoOpen] = useState(false);
  const [ingresoTipo, setIngresoTipo] = useState("");
  const [ingresoArticulo, setIngresoArticulo] = useState("");
  const [ingresoCant, setIngresoCant] = useState("");
  const [ingresoItems, setIngresoItems] = useState<IngresoTempItem[]>([]);
  const [ingresoObs, setIngresoObs] = useState("");
  const [isSavingIngreso, setIsSavingIngreso] = useState(false);

  const [isCierreOpen, setIsCierreOpen] = useState(false);
  const [cierreTipo, setCierreTipo] = useState("");
  const [cierreSearch, setCierreSearch] = useState("");
  const [cierreItems, setCierreItems] = useState<CierreItem[]>([]);
  const [cierreObs, setCierreObs] = useState("");
  const [isCierreResumenOpen, setIsCierreResumenOpen] = useState(false);
  const [isSavingCierre, setIsSavingCierre] = useState(false);

  const [isOutOfStockOpen, setIsOutOfStockOpen] = useState(false);
  const [outOfStockDismissed, setOutOfStockDismissed] = useState(false);
  const [outOfStockFilterTipo, setOutOfStockFilterTipo] = useState("");

  const tipoStockList: string[] = useMemo(() => {
    const raw = appData?.tipoStock || [];
    return raw.sort((a: any, b: any) => Number(a.id) - Number(b.id)).map(extractName).filter(Boolean);
  }, [appData?.tipoStock]);

  /* ── Fetch ALL stock (once) ───────────────────────────────────── */

  const loadAllStock = useCallback(async (showWarning = false) => {
    if (!token) return;
    setLoadingLabel("inventario");
    setIsLoading(true);
    setFetchError("");
    try {
      const res = await fetch(`/api/stock`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar stock");
      const data = await res.json();
      const mapped = (data.stock || []).map(mapStockRow);
      mapped.sort((a: StockRow, b: StockRow) => a.marca.localeCompare(b.marca) || a.modelo.localeCompare(b.modelo));
      setAllStock(mapped);
      setAllSalida(data.recentSalida || []);
      setDataLoaded(true);

      if (showWarning) {
        const zeroStock = mapped.filter((s: StockRow) => s.cantidad === 0);
        if (zeroStock.length > 0 && !outOfStockDismissed) setIsOutOfStockOpen(true);
      }
    } catch (err: any) {
      console.error("Stock fetch error:", err);
      setFetchError(err?.message || "Error al cargar stock");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Load on mount — show warning on initial load
  React.useEffect(() => {
    if (!dataLoaded && token) loadAllStock(true);
  }, [token, dataLoaded]);

  const handleApplyTipos = (next: string[]) => {
    setSelectedTipos(next);
    setOutOfStockDismissed(false);
    // Check out of stock for the applied selection
    const tipoSet = new Set(next);
    const filtered = next.length === 0 ? allStock : allStock.filter((s) => tipoSet.has(s.tipo));
    const zeroStock = filtered.filter((s) => s.cantidad === 0);
    if (zeroStock.length > 0 && !outOfStockDismissed) setIsOutOfStockOpen(true);
  };

  const refreshStock = () => loadAllStock();

  // Stock filtered by selected tipos (empty = show all)
  const stock = useMemo(() => {
    if (selectedTipos.length === 0) return allStock;
    const tipoSet = new Set(selectedTipos);
    return allStock.filter((s) => tipoSet.has(s.tipo));
  }, [allStock, selectedTipos]);

  const filteredStock = useMemo(() => {
    let result = stock;
    if (searchTerm) {
      const term = normalizeText(searchTerm);
      result = result.filter((s) =>
        normalizeText(s.marca).includes(term) || normalizeText(s.modelo).includes(term) ||
        normalizeText(s.descripcion).includes(term) || normalizeText(s.concatStock).includes(term) ||
        normalizeText(s.tipo).includes(term)
      );
    }
    result = [...result].sort((a, b) => {
      for (const { field, dir } of sortFields) {
        const cmp = (a[field] || "").localeCompare(b[field] || "");
        if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
      }
      return a.modelo.localeCompare(b.modelo);
    });
    return result;
  }, [stock, searchTerm, sortFields]);

  const totalUnits = useMemo(() => stock.reduce((s, i) => s + i.cantidad, 0), [stock]);
  const outOfStockItems = useMemo(() => {
    return stock.filter((s) => s.cantidad === 0);
  }, [stock]);

  /* ── Edit Quantity ─────────────────────────────────────────────── */
  const openEditModal = (item: StockRow) => { setIsOutOfStockOpen(false); setEditItem(item); setEditQty(String(item.cantidad)); };
  const saveEditQty = async () => {
    if (!editItem || !token) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/stock", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "editQty", id: editItem.id, newQty: Number(editQty), prevQty: editItem.cantidad, articulo: editItem.concatStock, tipo: editItem.tipo }) });
      if (!res.ok) throw new Error("Error al guardar");
      setEditItem(null);
      loadAllStock();
    } catch { alert("Error al guardar la cantidad"); } finally { setIsSavingEdit(false); }
  };

  /* ── Ingreso de Stock ──────────────────────────────────────────── */
  const ingresoStock = useMemo(() => ingresoTipo ? allStock.filter((s) => s.tipo === ingresoTipo) : [], [allStock, ingresoTipo]);

  const addIngresoItem = () => {
    if (!ingresoArticulo || !ingresoCant || Number(ingresoCant) <= 0) return;
    const found = allStock.find((s) => s.concatStock === ingresoArticulo);
    if (!found || ingresoItems.some((i) => i.stockId === found.id)) return;
    setIngresoItems((prev) => [...prev, { stockId: found.id, tipo: found.tipo, articulo: found.concatStock, cantIngresada: Number(ingresoCant), stockAnterior: found.cantidad, stockTotal: found.cantidad + Number(ingresoCant) }]);
    setIngresoArticulo(""); setIngresoCant("");
  };
  const closeIngreso = () => { setIsIngresoOpen(false); setIngresoItems([]); setIngresoObs(""); setIngresoTipo(""); setIngresoArticulo(""); setIngresoCant(""); };
  const saveIngreso = async () => {
    if (ingresoItems.length === 0 || !token) return;
    setIsSavingIngreso(true);
    try {
      const res = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "ingreso", items: ingresoItems, observaciones: ingresoObs }) });
      if (!res.ok) throw new Error("Error");
      closeIngreso(); loadAllStock();
    } catch { alert("Error al guardar el ingreso de stock"); } finally { setIsSavingIngreso(false); }
  };

  /* ── Cierre Diario ─────────────────────────────────────────────── */
  const openCierre = () => { setIsOutOfStockOpen(false); setCierreItems([]); setCierreTipo(""); setCierreSearch(""); setCierreObs(""); setIsCierreOpen(true); };
  const cierreStock = useMemo(() => cierreTipo ? allStock.filter((s) => s.tipo === cierreTipo) : [], [allStock, cierreTipo]);
  const filteredCierreStock = useMemo(() => {
    if (!cierreSearch) return cierreStock;
    const term = normalizeText(cierreSearch);
    return cierreStock.filter((s) => normalizeText(s.marca).includes(term) || normalizeText(s.modelo).includes(term) || normalizeText(s.concatStock).includes(term));
  }, [cierreStock, cierreSearch]);
  const getCierreSaliente = (stockId: string) => cierreItems.find((c) => c.stockId === stockId)?.saliente || 0;
  const setCierreSaliente = (item: StockRow, value: number) => {
    if (value < 0 || value > item.cantidad) return;
    setCierreItems((prev) => {
      const without = prev.filter((c) => c.stockId !== item.id);
      if (value === 0) return without;
      return [...without, { stockId: item.id, tipo: item.tipo, articulo: item.concatStock, anterior: item.cantidad, saliente: value, resultado: item.cantidad - value }];
    });
  };
  const saveCierre = async () => {
    if (cierreItems.length === 0 || !token) return;
    setIsSavingCierre(true);
    try {
      const res = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "cierreDiario", items: cierreItems, observaciones: cierreObs }) });
      if (!res.ok) throw new Error("Error");
      setIsCierreResumenOpen(false); setIsCierreOpen(false); setCierreItems([]); setCierreObs(""); setCierreTipo("");  loadAllStock();
    } catch { alert("Error al guardar el cierre diario"); } finally { setIsSavingCierre(false); }
  };

  /* ── Excel ─────────────────────────────────────────────────────── */
  const exportExcel = () => {
    if (filteredStock.length === 0) return;
    const data = filteredStock.map((s) => ({ Tipo: s.tipo, Marca: s.marca, Modelo: s.modelo, Descripcion: s.descripcion, Cantidad: s.cantidad }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `Stock_${selectedTipo}_${new Date().toLocaleDateString().replace(/\//g, "-")}.xlsx`);
  };

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-2rem)] gap-4 relative">

      {/* Loading overlay — same as global Sincronizando */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-300">
          <div className="bg-white/90 p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[240px] w-full mx-4 border border-white/20">
            <Loader2 className="w-8 h-8 text-[#113123] animate-spin mb-3" />
            <h2 className="text-[#113123] text-lg font-bold mb-1 tracking-tight">Sincronizando...</h2>
            <p className="text-slate-600 text-[10px] text-center leading-relaxed">Cargando stock de {loadingLabel}.</p>
          </div>
        </div>
      )}

      {/* 1. Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap xl:flex-nowrap gap-4 items-center justify-between flex-none transition-all duration-300">
        <div className="flex items-center gap-4 w-full xl:w-auto flex-1 min-w-0">
          <div className="hidden xl:block pr-6 border-r border-slate-100 flex-none">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Inventario</h1>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">Gestión de stock</p>
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <MultiSelect
              selected={selectedTipos}
              placeholder="Todos los tipos"
              options={tipoStockList}
              onApply={handleApplyTipos}
              className="w-52"
            />
            <div className="relative w-full xl:w-[240px] group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
              <Input placeholder="Buscar marca, modelo..." className="pl-9 bg-slate-50/50 border-slate-200/60 focus:bg-white h-10 text-sm w-full rounded-xl transition-all"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full xl:w-auto justify-between xl:justify-end flex-shrink-0">
          <Button variant="outline" size="sm" className="h-10 text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl font-medium" onClick={() => refreshStock()}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Actualizar
          </Button>
          <Button variant="outline" size="sm" className="h-10 hidden sm:flex text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl font-medium" onClick={exportExcel} disabled={filteredStock.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Excel
          </Button>
          <Button size="sm" className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 px-4 rounded-xl font-medium" onClick={() => { setIsOutOfStockOpen(false); setIngresoTipo(""); setIsIngresoOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Ingresar Stock
          </Button>
        </div>
      </div>

      {/* 2. Table */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col min-h-0 relative transition-all">
        {!dataLoaded && !fetchError ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 p-8 gap-3">
            <AlertTriangle className="w-10 h-10 opacity-60" />
            <p className="font-bold">Error al cargar stock</p>
            <p className="text-sm text-slate-500 text-center max-w-md">{fetchError}</p>
            <Button variant="outline" size="sm" className="mt-2 rounded-xl" onClick={() => refreshStock()}>Reintentar</Button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 z-10">
                <tr className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {(["tipo", "marca"] as const).map((field) => {
                    const entry = sortFields.find((s) => s.field === field);
                    const idx = entry ? sortFields.indexOf(entry) : -1;
                    return (
                      <th key={field} className={cn("py-3", field === "tipo" ? "px-5" : "px-4", "cursor-pointer hover:text-slate-800 transition-colors")}
                        onClick={() => setSortFields((prev) => {
                          const existing = prev.find((s) => s.field === field);
                          if (existing) {
                            if (existing.dir === "asc") return prev.map((s) => s.field === field ? { ...s, dir: "desc" as const } : s);
                            return prev.filter((s) => s.field !== field); // third click removes
                          }
                          return [...prev, { field, dir: "asc" as const }];
                        })}>
                        <div className="flex items-center gap-1">
                          {field === "tipo" ? "Tipo" : "Marca"}
                          {entry ? (
                            <span className="flex items-center gap-0.5">
                              {entry.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                              {sortFields.length > 1 && <span className="text-[9px] text-emerald-600 font-bold">{idx + 1}</span>}
                            </span>
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-3 px-4">Modelo</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4 text-center w-[100px]">Cantidad</th>
                  <th className="py-3 px-5 text-center w-[70px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredStock.map((item) => (
                  <tr key={item.id} className={cn("transition-colors hover:bg-slate-50/50 group", item.cantidad === 0 && "bg-red-50/30")}>
                    <td className="py-3 px-5 align-middle">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{shortTipo(item.tipo)}</span>
                    </td>
                    <td className="py-3 px-4 align-middle">
                      <span className="font-semibold text-slate-900 text-xs">{item.marca}</span>
                    </td>
                    <td className="py-3 px-4 align-middle">
                      <span className="text-slate-700 text-xs font-medium">{item.modelo}</span>
                    </td>
                    <td className="py-3 px-4 align-middle">
                      <span className="text-slate-500 text-xs truncate block max-w-[250px]" title={item.descripcion}>{item.descripcion || "-"}</span>
                    </td>
                    <td className="py-3 px-4 align-middle text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md font-bold text-xs px-2",
                        item.cantidad === 0 ? "bg-red-100 text-red-700" : item.cantidad <= 2 ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"
                      )}>
                        {item.cantidad}
                      </span>
                    </td>
                    <td className="py-3 px-5 align-middle text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        onClick={() => openEditModal(item)} title="Editar cantidad">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredStock.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="text-center py-24">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                          <Search className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="font-semibold text-slate-600">No se encontraron artículos</p>
                        <p className="text-sm mt-1">Intenta cambiar el filtro o la búsqueda</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Footer — always visible */}
        <div className="bg-white border-t border-slate-200/60 p-4 z-20 flex-none">
          <div className="flex justify-between items-center">
            <div className="text-slate-500 font-medium text-xs">
              {dataLoaded ? <>Stock{selectedTipos.length === 1 ? ` ${selectedTipos[0]}` : selectedTipos.length > 1 ? ` (${selectedTipos.length} tipos)` : " total"} : <span className="text-slate-900 font-bold">{totalUnits}</span> unidades</> : ""}
            </div>
            <Button size="sm" className="h-10 bg-slate-900 hover:bg-slate-800 text-white shadow-sm px-5 rounded-xl font-medium"
              onClick={openCierre}>
              Cierre Diario <ClipboardList className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════ MODAL: Editar Cantidad ═══════════════════════ */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)} title="Editar cantidad" preventBackdropClose>
        {editItem && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-emerald-700">{editItem.concatStock}</p>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cantidad</label>
              <Input type="number" min="0" autoFocus className="h-10 rounded-xl" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 text-slate-500 rounded-xl h-10" onClick={() => setEditItem(null)}>Cancelar</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-medium rounded-xl h-10" onClick={saveEditQty}
                disabled={isSavingEdit} isLoading={isSavingEdit}>Guardar</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ═══════════════ MODAL: Ingresar Stock ════════════════════════ */}
      <Dialog open={isIngresoOpen} onOpenChange={(open) => !open && closeIngreso()} title="Ingresar Stock" className="max-w-2xl" preventBackdropClose>
        <div className="space-y-5">
          {/* Row 1: Tipo + Articulo + Cantidad */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">Tipo de stock</label>
            <Dropdown value={ingresoTipo} placeholder="Seleccionar tipo..."
              options={tipoStockList.map((t) => ({ label: t, value: t }))}
              onSelect={(v) => { setIngresoTipo(v); setIngresoArticulo(""); }} />
          </div>

          <div className="grid grid-cols-[1fr_70px_40px] gap-2 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">Artículo</label>
              <Dropdown value={ingresoArticulo}
                placeholder="Seleccionar artículo..."
                options={ingresoStock.map((s) => ({ label: s.concatStock, value: s.concatStock }))}
                onSelect={setIngresoArticulo} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">Cant.</label>
              <Input type="number" min="1" placeholder="0" className="h-10 rounded-xl text-center" value={ingresoCant} onChange={(e) => setIngresoCant(e.target.value)} />
            </div>
            <Button className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 shrink-0 p-0 rounded-xl" onClick={addIngresoItem} disabled={!ingresoArticulo || !ingresoCant}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Items list */}
          <div className="rounded-xl border border-slate-200/80 overflow-hidden max-h-[280px] overflow-y-auto">
            {ingresoItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                <Package className="w-5 h-5 mb-1.5" />
                <p className="text-xs">Agregá artículos con el botón +</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/80">
                {ingresoItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 truncate">{item.articulo}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {item.stockAnterior} → <span className="text-emerald-600">{item.stockTotal}</span> <span className="text-slate-300">(+{item.cantIngresada})</span>
                      </p>
                    </div>
                    <button onClick={() => setIngresoItems((p) => p.filter((_, i) => i !== idx))} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">Observaciones</label>
            <textarea className="w-full min-h-[55px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm resize-none placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="Opcional" value={ingresoObs} onChange={(e) => setIngresoObs(e.target.value)} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 mr-auto">{ingresoItems.length > 0 ? `${ingresoItems.length} artículo${ingresoItems.length > 1 ? "s" : ""}` : ""}</span>
            <Button variant="ghost" className="text-slate-400 rounded-xl h-10 px-5 font-normal" onClick={closeIngreso}>Cancelar</Button>
            <Button className="bg-slate-900 hover:bg-slate-800 rounded-xl h-10 px-6" onClick={saveIngreso} disabled={ingresoItems.length === 0 || isSavingIngreso} isLoading={isSavingIngreso}>Guardar Ingreso</Button>
          </div>
        </div>
      </Dialog>

      {/* ═══════════════ MODAL: Cierre Diario ═════════════════════════ */}
      <Dialog open={isCierreOpen} onOpenChange={(open) => !open && setIsCierreOpen(false)} title="Cierre Diario" className="max-w-2xl" preventBackdropClose>
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex gap-3">
            <div className="space-y-1.5 w-52">
              <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tipo de stock</label>
              <Dropdown value={cierreTipo} placeholder="Seleccionar tipo..."
                options={tipoStockList.map((t) => ({ label: t, value: t }))}
                onSelect={(v) => { setCierreTipo(v); setCierreSearch(""); }} />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Buscar</label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                <Input placeholder="Buscar artículo..." className="pl-9 h-10 text-sm rounded-xl" value={cierreSearch} onChange={(e) => setCierreSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[380px] overflow-y-auto">
            {!cierreTipo ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Package className="w-6 h-6 text-slate-300 mb-2" />
                <p className="text-xs font-medium">Seleccioná un tipo de stock</p>
              </div>
            ) : filteredCierreStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Search className="w-6 h-6 text-slate-300 mb-2" />
                <p className="text-xs font-medium">Sin resultados</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200 z-10">
                  <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4 text-left">Artículo</th>
                    <th className="py-2.5 px-2 text-center w-[70px]">Stock</th>
                    <th className="py-2.5 px-2 text-center w-[80px]">Salida</th>
                    <th className="py-2.5 px-2 text-center w-[70px]">Total</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {filteredCierreStock.map((item) => {
                    const sal = getCierreSaliente(item.id);
                    const total = item.cantidad - sal;
                    return (
                      <tr key={item.id} className={cn("transition-colors", sal > 0 ? "bg-amber-50/30" : "hover:bg-slate-50/50")}>
                        <td className="py-2.5 px-4">
                          <span className="text-xs text-slate-700 font-medium">{item.concatStock}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px] px-1.5">{item.cantidad}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input type="number" min="0" max={item.cantidad}
                            className="w-16 h-7 rounded-lg border border-slate-200 bg-white text-center text-xs font-medium focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition-all"
                            value={sal || ""} placeholder="0"
                            onChange={(e) => setCierreSaliente(item, Number(e.target.value) || 0)} />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={cn("inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md font-bold text-[11px] px-1.5",
                            total === 0 ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700")}>{total}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {sal > 0 && (
                            <button onClick={() => setCierreItems((p) => p.filter((c) => c.stockId !== item.id))} className="p-1 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Observaciones</label>
            <textarea className="w-full min-h-[50px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm resize-none placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="Opcional" value={cierreObs} onChange={(e) => setCierreObs(e.target.value)} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400 mr-auto">{cierreItems.length > 0 ? `${cierreItems.length} artículo${cierreItems.length > 1 ? "s" : ""} con salida` : ""}</span>
            <Button variant="ghost" className="text-slate-500 rounded-xl h-10 px-5" onClick={() => setIsCierreOpen(false)}>Cancelar</Button>
            <Button className="bg-slate-900 hover:bg-slate-800 font-medium rounded-xl h-10 px-6" onClick={() => { if (cierreItems.length > 0) { setIsCierreOpen(false); setIsCierreResumenOpen(true); } }} disabled={cierreItems.length === 0}>Confirmar Cierre</Button>
          </div>
        </div>
      </Dialog>

      {/* ═══════════════ MODAL: Resumen Cierre ════════════════════════ */}
      <Dialog open={isCierreResumenOpen} onOpenChange={(open) => { if (!open) { setIsCierreResumenOpen(false); setIsCierreOpen(true); } }} title="Resumen Cierre Diario" preventBackdropClose>
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-xl max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200">
                <tr className="text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-2.5 px-3 text-left">Articulo</th>
                  <th className="py-2.5 px-2 text-center w-14">Sal.</th>
                  <th className="py-2.5 px-2 text-center w-14">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cierreItems.map((item) => (
                  <tr key={item.stockId}>
                    <td className="py-2.5 px-3 text-xs text-slate-700">{item.articulo}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-amber-100 text-amber-700 font-bold text-xs">{item.saliente}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={cn("inline-flex items-center justify-center w-8 h-6 rounded-md font-bold text-xs",
                        item.resultado === 0 ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700")}>{item.resultado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1 text-slate-500 rounded-xl" onClick={() => { setIsCierreResumenOpen(false); setIsCierreOpen(true); }}>Atras</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl" onClick={saveCierre} disabled={isSavingCierre} isLoading={isSavingCierre}>Aceptar</Button>
          </div>
        </div>
      </Dialog>

      {/* ═══════════════ MODAL: Sin Stock ═════════════════════════════ */}
      <Dialog open={isOutOfStockOpen} onOpenChange={(open) => { if (!open) { setIsOutOfStockOpen(false); setOutOfStockDismissed(true); setOutOfStockFilterTipo(""); } }} title="¡Te quedaste sin Stock!" className="max-w-2xl">
        <div className="space-y-4">
          {/* Tipo tags */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setOutOfStockFilterTipo("")}
              className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                !outOfStockFilterTipo ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
              Todos ({outOfStockItems.length})
            </button>
            {[...new Set(outOfStockItems.map((s) => s.tipo))].sort().map((t) => {
              const count = outOfStockItems.filter((s) => s.tipo === t).length;
              return (
                <button key={t} onClick={() => setOutOfStockFilterTipo(outOfStockFilterTipo === t ? "" : t)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    outOfStockFilterTipo === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  {shortTipo(t)} ({count})
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200 z-10">
                <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4 text-left w-[120px]">Tipo</th>
                  <th className="py-2.5 px-4 text-left">Artículo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {[...(outOfStockFilterTipo ? outOfStockItems.filter((s) => s.tipo === outOfStockFilterTipo) : outOfStockItems)]
                  .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.marca.localeCompare(b.marca))
                  .map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{shortTipo(item.tipo)}</span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700">{item.marca} - {item.modelo}{item.descripcion ? ` - ${item.descripcion}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1 text-slate-500 rounded-xl" onClick={() => { setIsOutOfStockOpen(false); setOutOfStockDismissed(true); }}>Atras</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl" onClick={() => { setIsOutOfStockOpen(false); setOutOfStockDismissed(true); }}>Aceptar</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
