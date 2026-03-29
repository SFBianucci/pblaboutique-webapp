import React, { useState, useMemo, useCallback } from "react";
import {
  FileSpreadsheet,
  Loader2,
  Eye,
  Search,
  ChevronDown,
  X,
  AlertTriangle,
  CalendarIcon,
} from "lucide-react";
import * as Popover from '@radix-ui/react-popover';
import { format, subMonths } from "date-fns";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Dialog } from "../components/ui/Dialog";
import { Calendar } from "../components/ui/Calendar";
import { useAppData } from "../lib/AppDataContext";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";
// @ts-ignore
import * as XLSX from "xlsx";

/* ── Types ───────────────────────────────────────────────────────── */

type ReportType = "ingresos" | "salidas" | "ediciones";

interface IngresoRow {
  id: string;
  Fecha_IS: string;
  Hora_IS: string;
  User_IS: string;
  Unidades_IS: string;
  Observaciones_IS: string;
  Aux_IS: string;
}

interface SalidaRow {
  id: string;
  Fecha_CD: string;
  Hora_CD: string;
  User_CD: string;
  CantSaliente_CD: string;
  Observaciones_CD: string;
  Aux_CD: string;
}

interface EdicionRow {
  id: string;
  Fecha_ST: string;
  Hora_ST: string;
  UserMod_ST: string;
  Tipo_ST: string;
  Articulo_ST: string;
  CantidadAnterior_ST: string;
  CantidadNueva_ST: string;
}

interface IngresoDetailRow {
  Tipo_DIS: string;
  ConcatArt_DIS: string;
  Cantidad_DIS: string;
  CantidadAnterior_DIS: string;
  CantResultande_DIS: string;
}

interface SalidaDetailRow {
  TipoStock_SS: string;
  Articulo_SS: string;
  CantidadSaliente_SS: string;
  CantidadAnterior_SS: string;
  CantidadResultante_SS: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const normalizeText = (v: string) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const extractName = (item: any): string => {
  const candidates = [
    item.Tipo_TS,
    item.Tipo_x0020_TS,
    item.Title,
    item.Titulo_TS,
    item.Nombre_TS,
    item.TipoStock_TS,
  ];
  const found = candidates.find(
    (v) =>
      typeof v === "string" && v.length > 0 && v.toLowerCase() !== "boutique"
  );
  if (found) return found;
  const skip = new Set([
    "id",
    "Title",
    "@odata.etag",
    "ContentType",
    "Modified",
    "Created",
    "AuthorLookupId",
    "EditorLookupId",
    "Attachments",
    "Edit",
    "ItemChildCount",
    "FolderChildCount",
    "_UIVersionString",
    "Status_TS",
    "Status_x0020_TS",
  ]);
  for (const [key, val] of Object.entries(item)) {
    if (skip.has(key)) continue;
    if (
      typeof val === "string" &&
      val.length > 1 &&
      val.toLowerCase() !== "boutique" &&
      val !== "Activo"
    )
      return val;
  }
  return "";
};

const fmtDate = (d: Date): string =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/* ── Dropdown (same as Inventory) ────────────────────────────────── */

const Dropdown = ({
  value,
  placeholder,
  options,
  onSelect,
  className,
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
  const filtered = search
    ? options.filter((o) =>
        normalizeText(o.label).includes(normalizeText(search))
      )
    : options;

  const handleOpen = () => {
    setOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="w-full h-10 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm text-left flex items-center justify-between hover:border-slate-300 transition-colors"
      >
        <span
          className={
            value ? "text-slate-900 font-medium" : "text-slate-400"
          }
        >
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect("");
              }}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-80 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-slate-100">
              <input
                ref={inputRef}
                type="text"
                className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto max-h-68">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-400 text-center">
                  Sin resultados
                </div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      "w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors",
                      opt.value === value &&
                        "bg-emerald-50 text-emerald-800 font-medium"
                    )}
                    onClick={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ── Component ───────────────────────────────────────────────────── */

export const StockReports: React.FC = () => {
  const { appData } = useAppData();
  const { token } = useAuth();

  const [reportType, setReportType] = useState<ReportType>("ingresos");
  const [dateFrom, setDateFrom] = useState<Date>(subMonths(new Date(), 6));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [tipoFilter, setTipoFilter] = useState("");

  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);

  // Detail modal
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const tipoStockList: string[] = useMemo(() => {
    const raw = appData?.tipoStock || [];
    return raw
      .sort((a: any, b: any) => Number(a.id) - Number(b.id))
      .map(extractName)
      .filter(Boolean);
  }, [appData?.tipoStock]);

  /* ── Fetch rows ────────────────────────────────────────────────── */

  const fetchRows = useCallback(
    async (type?: ReportType) => {
      if (!token) return;
      const rt = type || reportType;
      setIsLoading(true);
      setFetchError("");
      try {
        const params = new URLSearchParams({ reportType: rt });
        if (tipoFilter) params.set("tipo", tipoFilter);
        if (dateFrom) params.set("from", fmtDate(dateFrom));
        if (dateTo) params.set("to", fmtDate(dateTo));

        const res = await fetch(`/api/stock-reports?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Error al cargar reportes");
        const data = await res.json();
        setRows(data.rows || []);
        setDataLoaded(true);
      } catch (err: any) {
        console.error("Stock reports fetch error:", err);
        setFetchError(err?.message || "Error al cargar reportes");
      } finally {
        setIsLoading(false);
      }
    },
    [token, reportType, tipoFilter, dateFrom, dateTo]
  );

  // Load on mount and when filters change
  React.useEffect(() => {
    if (token) fetchRows();
  }, [token, reportType, tipoFilter, dateFrom, dateTo]);

  /* ── Detail fetch ──────────────────────────────────────────────── */

  const openIngresoDetail = async (row: IngresoRow) => {
    if (!token) return;
    setDetailTitle(`Detalle Ingreso - ${row.Fecha_IS} - ${row.User_IS}`);
    setDetailOpen(true);
    setDetailRows([]);
    setIsLoadingDetail(true);
    try {
      const params = new URLSearchParams({
        reportType: "ingresos",
        ingresoId: row.Aux_IS,
      });
      const res = await fetch(`/api/stock-reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar detalle");
      const data = await res.json();
      setDetailRows(data.detail || []);
    } catch (err: any) {
      console.error("Detail fetch error:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openSalidaDetail = async (row: SalidaRow) => {
    if (!token) return;
    setDetailTitle(`Detalle Salida - ${row.Fecha_CD} - ${row.User_CD}`);
    setDetailOpen(true);
    setDetailRows([]);
    setIsLoadingDetail(true);
    try {
      const params = new URLSearchParams({
        reportType: "salidas",
        cierreId: row.Aux_CD,
      });
      const res = await fetch(`/api/stock-reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al cargar detalle");
      const data = await res.json();
      setDetailRows(data.detail || []);
    } catch (err: any) {
      console.error("Detail fetch error:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  /* ── Excel export ──────────────────────────────────────────────── */

  const exportExcel = () => {
    if (rows.length === 0) return;

    let data: any[];
    let sheetName: string;

    if (reportType === "ingresos") {
      sheetName = "Ingresos";
      data = rows.map((r: IngresoRow) => ({
        Fecha: r.Fecha_IS || "",
        Hora: r.Hora_IS || "",
        Usuario: r.User_IS || "",
        Unidades: r.Unidades_IS || "",
        Observaciones: r.Observaciones_IS || "",
      }));
    } else if (reportType === "salidas") {
      sheetName = "Salidas";
      data = rows.map((r: SalidaRow) => ({
        Fecha: r.Fecha_CD || "",
        Hora: r.Hora_CD || "",
        Usuario: r.User_CD || "",
        "Cant. Saliente": r.CantSaliente_CD || "",
        Observaciones: r.Observaciones_CD || "",
      }));
    } else {
      sheetName = "Ediciones";
      data = rows.map((r: EdicionRow) => ({
        Fecha: r.Fecha_ST || "",
        Hora: r.Hora_ST || "",
        Usuario: r.UserMod_ST || "",
        Tipo: r.Tipo_ST || "",
        Articulo: r.Articulo_ST || "",
        Anterior: r.CantidadAnterior_ST || "",
        Nueva: r.CantidadNueva_ST || "",
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(
      wb,
      `ReporteStock_${sheetName}_${new Date().toLocaleDateString().replace(/\//g, "-")}.xlsx`
    );
  };

  /* ── Render ────────────────────────────────────────────────────── */

  const reportTabs: { key: ReportType; label: string }[] = [
    { key: "ingresos", label: "Ingresos" },
    { key: "salidas", label: "Salidas" },
    { key: "ediciones", label: "Ediciones" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-2rem)] gap-4 relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-300">
          <div className="bg-white/90 p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[240px] w-full mx-4 border border-white/20">
            <Loader2 className="w-8 h-8 text-[#113123] animate-spin mb-3" />
            <h2 className="text-[#113123] text-lg font-bold mb-1 tracking-tight">
              Sincronizando...
            </h2>
            <p className="text-slate-600 text-[10px] text-center leading-relaxed">
              Cargando reportes de stock.
            </p>
          </div>
        </div>
      )}

      {/* 1. Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap xl:flex-nowrap gap-4 items-center justify-between flex-none transition-all duration-300">
        <div className="flex items-center gap-4 w-full xl:w-auto flex-1 min-w-0">
          {/* Title */}
          <div className="hidden xl:block pr-6 border-r border-slate-100 flex-none">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
              Reportes Stock
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">
              Historial de movimientos
            </p>
          </div>

          {/* Report type tabs */}
          <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1">
            {reportTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setReportType(tab.key)}
                className={cn(
                  "px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200",
                  reportType === tab.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date pickers */}
          <div className="flex items-center gap-2">
            <Popover.Root>
              <Popover.Trigger asChild>
                <Button variant="outline" className="h-10 rounded-xl border-slate-200/60 bg-slate-50/50 hover:bg-white text-sm font-normal px-3 w-[145px] justify-start">
                  <CalendarIcon className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  {format(dateFrom, "dd/MM/yyyy")}
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="w-auto p-0 bg-white rounded-lg border shadow-xl z-[9999]" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <span className="text-slate-400 text-xs font-medium">a</span>
            <Popover.Root>
              <Popover.Trigger asChild>
                <Button variant="outline" className="h-10 rounded-xl border-slate-200/60 bg-slate-50/50 hover:bg-white text-sm font-normal px-3 w-[145px] justify-start">
                  <CalendarIcon className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  {format(dateTo, "dd/MM/yyyy")}
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="w-auto p-0 bg-white rounded-lg border shadow-xl z-[9999]" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          {/* Tipo dropdown */}
          <Dropdown
            value={tipoFilter}
            placeholder="Todos los tipos"
            options={tipoStockList.map((t) => ({ label: t, value: t }))}
            onSelect={setTipoFilter}
            className="w-48"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full xl:w-auto justify-between xl:justify-end flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-10 hidden sm:flex text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl font-medium"
            onClick={exportExcel}
            disabled={rows.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />{" "}
            Excel
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
            <p className="font-bold">Error al cargar reportes</p>
            <p className="text-sm text-slate-500 text-center max-w-md">
              {fetchError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 rounded-xl"
              onClick={() => fetchRows()}
            >
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm">
              {/* ── Ingresos table ── */}
              {reportType === "ingresos" && (
                <>
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 z-10">
                    <tr className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5">Fecha</th>
                      <th className="py-3 px-4">Hora</th>
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4 text-center">Unidades</th>
                      <th className="py-3 px-4">Observaciones</th>
                      <th className="py-3 px-5 text-center w-[70px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {(rows as IngresoRow[]).map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-slate-50/50 group"
                      >
                        <td className="py-3 px-5 align-middle">
                          <span className="font-semibold text-slate-900 text-xs">
                            {row.Fecha_IS}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-700 text-xs">
                            {row.Hora_IS}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-700 text-xs font-medium">
                            {row.User_IS}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md font-bold text-xs px-2 bg-emerald-50 text-emerald-700">
                            {row.Unidades_IS}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-500 text-xs truncate block max-w-[250px]">
                            {row.Observaciones_IS || "-"}
                          </span>
                        </td>
                        <td className="py-3 px-5 align-middle text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            onClick={() => openIngresoDetail(row)}
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={6} className="text-center py-24">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                              <Search className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="font-semibold text-slate-600">
                              No se encontraron registros
                            </p>
                            <p className="text-sm mt-1">
                              Intenta cambiar los filtros de fecha o tipo
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}

              {/* ── Salidas table ── */}
              {reportType === "salidas" && (
                <>
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 z-10">
                    <tr className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5">Fecha</th>
                      <th className="py-3 px-4">Hora</th>
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4 text-center">
                        Cant. Saliente
                      </th>
                      <th className="py-3 px-4">Observaciones</th>
                      <th className="py-3 px-5 text-center w-[70px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {(rows as SalidaRow[]).map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-slate-50/50 group"
                      >
                        <td className="py-3 px-5 align-middle">
                          <span className="font-semibold text-slate-900 text-xs">
                            {row.Fecha_CD}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-700 text-xs">
                            {row.Hora_CD}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-700 text-xs font-medium">
                            {row.User_CD}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md font-bold text-xs px-2 bg-amber-50 text-amber-700">
                            {row.CantSaliente_CD}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-500 text-xs truncate block max-w-[250px]">
                            {row.Observaciones_CD || "-"}
                          </span>
                        </td>
                        <td className="py-3 px-5 align-middle text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            onClick={() => openSalidaDetail(row)}
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={6} className="text-center py-24">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                              <Search className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="font-semibold text-slate-600">
                              No se encontraron registros
                            </p>
                            <p className="text-sm mt-1">
                              Intenta cambiar los filtros de fecha o tipo
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}

              {/* ── Ediciones table ── */}
              {reportType === "ediciones" && (
                <>
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 z-10">
                    <tr className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5">Fecha</th>
                      <th className="py-3 px-4">Hora</th>
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Articulo</th>
                      <th className="py-3 px-4 text-center">Anterior</th>
                      <th className="py-3 px-4 text-center">Nueva</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {(rows as EdicionRow[]).map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-slate-50/50 group"
                      >
                        <td className="py-3 px-5 align-middle">
                          <span className="font-semibold text-slate-900 text-xs">
                            {row.Fecha_ST}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-700 text-xs">
                            {row.Hora_ST}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-700 text-xs font-medium">
                            {row.UserMod_ST}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                            {row.Tipo_ST}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <span className="text-slate-700 text-xs truncate block max-w-[200px]">
                            {row.Articulo_ST}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md font-bold text-xs px-2 bg-slate-100 text-slate-700">
                            {row.CantidadAnterior_ST}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md font-bold text-xs px-2 bg-emerald-50 text-emerald-700">
                            {row.CantidadNueva_ST}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={7} className="text-center py-24">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                              <Search className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="font-semibold text-slate-600">
                              No se encontraron registros
                            </p>
                            <p className="text-sm mt-1">
                              Intenta cambiar los filtros de fecha o tipo
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}

        {/* 3. Footer */}
        <div className="bg-white border-t border-slate-200/60 p-4 z-20 flex-none">
          <div className="flex justify-between items-center">
            <div className="text-slate-500 font-medium text-xs">
              {dataLoaded ? (
                <>
                  Mostrando{" "}
                  <span className="text-slate-900 font-bold">
                    {rows.length}
                  </span>{" "}
                  registros
                </>
              ) : (
                ""
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ MODAL: Detalle ══════════════════════════════ */}
      <Dialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detailTitle}
        className="max-w-3xl"
        preventBackdropClose
      >
        <div className="space-y-4">
          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
          ) : detailRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="w-5 h-5 mb-2" />
              <p className="text-sm">Sin registros de detalle</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/80 overflow-hidden max-h-[450px] overflow-y-auto">
              <table className="w-full text-sm">
                {reportType === "ingresos" && (
                  <>
                    <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 z-10">
                      <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4 text-left w-[110px]">Tipo</th>
                        <th className="py-2.5 px-4 text-left">Artículo</th>
                        <th className="py-2.5 px-3 text-center w-[70px]">Cant.</th>
                        <th className="py-2.5 px-3 text-center w-[70px]">Ant.</th>
                        <th className="py-2.5 px-3 text-center w-[70px]">Result.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {(detailRows as IngresoDetailRow[]).map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-4">
                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 uppercase">{d.Tipo_DIS}</span>
                          </td>
                          <td className="py-2 px-4 text-xs text-slate-700">{d.ConcatArt_DIS}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded font-bold text-[11px] px-1.5 bg-emerald-50 text-emerald-700">{d.Cantidad_DIS}</span>
                          </td>
                          <td className="py-2 px-3 text-center text-xs text-slate-500">{d.CantidadAnterior_DIS}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn("font-semibold text-xs", Number(d.CantResultande_DIS) === 0 ? "text-red-600" : "text-slate-900")}>{d.CantResultande_DIS}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
                {reportType === "salidas" && (
                  <>
                    <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 z-10">
                      <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4 text-left w-[110px]">Tipo</th>
                        <th className="py-2.5 px-4 text-left">Artículo</th>
                        <th className="py-2.5 px-3 text-center w-[70px]">Salida</th>
                        <th className="py-2.5 px-3 text-center w-[70px]">Ant.</th>
                        <th className="py-2.5 px-3 text-center w-[70px]">Result.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {(detailRows as SalidaDetailRow[]).map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-4">
                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 uppercase">{d.TipoStock_SS}</span>
                          </td>
                          <td className="py-2 px-4 text-xs text-slate-700">{d.Articulo_SS}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded font-bold text-[11px] px-1.5 bg-amber-50 text-amber-700">{d.CantidadSaliente_SS}</span>
                          </td>
                          <td className="py-2 px-3 text-center text-xs text-slate-500">{d.CantidadAnterior_SS}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn("font-semibold text-xs", Number(d.CantidadResultante_SS) === 0 ? "text-red-600" : "text-slate-900")}>{d.CantidadResultante_SS}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          )}

          {/* Footer */}
          {detailRows.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">{detailRows.length} artículo{detailRows.length > 1 ? "s" : ""}</span>
              <Button variant="ghost" className="text-slate-500 rounded-xl h-9 px-4" onClick={() => setDetailOpen(false)}>Cerrar</Button>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};
