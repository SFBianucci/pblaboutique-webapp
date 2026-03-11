import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, Search, FileSpreadsheet, Plus, Filter, ClipboardList, 
  AlertTriangle, Package, TrendingUp, ArrowDown, ArrowUp, Car, Shield, 
  Wind, Layers, Box, MoreVertical, Edit3, Trash2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Dialog } from '../components/ui/Dialog';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { StockItem, StockCategory } from '../types';
import { cn, formatCurrency } from '../lib/utils';

// --- MOCK DATA ---
const MOCK_STOCK: StockItem[] = [
    { id: '1', category: 'Parabrisas', brand: 'FORD', model: 'RANGER 2023+', description: 'Parabrisas C/ Sensor Lluvia', quantity: 12, minStock: 5, price: 185000 },
    { id: '2', category: 'Parabrisas', brand: 'TOYOTA', model: 'HILUX 2016-2022', description: 'Parabrisas Laminado', quantity: 3, minStock: 5, price: 145000 },
    { id: '3', category: 'Lunetas', brand: 'VW', model: 'GOL TREND', description: 'Luneta Térmica Original', quantity: 0, minStock: 2, price: 98000 },
    { id: '4', category: 'Escobillas', brand: 'BOSCH', model: 'UNIVERSAL 24"', description: 'Escobilla AeroTwin', quantity: 45, minStock: 10, price: 12500 },
    { id: '5', category: 'Laterales', brand: 'PEUGEOT', model: '208', description: 'Cristal Puerta Delantera Izq', quantity: 2, minStock: 2, price: 45000 },
    { id: '6', category: 'Parabrisas', brand: 'VW', model: 'AMAROK', description: 'Parabrisas C/ Antena', quantity: 8, minStock: 4, price: 165000 },
    { id: '7', category: 'Pegamentos', brand: 'SIKA', model: 'SikaFlex 256', description: 'Poliuretano para Cristales', quantity: 120, minStock: 24, price: 8500 },
    { id: '8', category: 'Burletes', brand: 'GENERICO', model: 'Universal T', description: 'Burlete Universal T 15mm', quantity: 50, minStock: 20, price: 2100 },
];

const CATEGORIES: { label: string; value: StockCategory | 'all'; icon: any }[] = [
    { label: 'Todos', value: 'all', icon: Package },
    { label: 'Parabrisas', value: 'Parabrisas', icon: Shield },
    { label: 'Lunetas', value: 'Lunetas', icon: Car },
    { label: 'Laterales', value: 'Laterales', icon: Layers },
    { label: 'Escobillas', value: 'Escobillas', icon: Wind },
    { label: 'Insumos', value: 'Pegamentos', icon: Box },
];

export const Inventory: React.FC = () => {
  const [stock, setStock] = useState<StockItem[]>(MOCK_STOCK);
  const [activeCategory, setActiveCategory] = useState<StockCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);

  // --- LOGICA DE FILTRADO ---
  const filteredStock = useMemo(() => {
      return stock.filter(item => {
          const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
          const matchesSearch = 
            item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesCategory && matchesSearch;
      });
  }, [stock, activeCategory, searchTerm]);

  // --- TOTALES ---
  const stats = useMemo(() => {
      const totalItems = stock.reduce((acc, i) => acc + i.quantity, 0);
      const lowStockCount = stock.filter(i => i.quantity <= i.minStock && i.quantity > 0).length;
      const outOfStockCount = stock.filter(i => i.quantity === 0).length;
      const totalValue = stock.reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0);
      return { totalItems, lowStockCount, outOfStockCount, totalValue };
  }, [stock]);

  // --- RENDER HELPERS ---
  const getStockBadge = (quantity: number, min: number) => {
      if (quantity === 0) return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">Sin Stock</Badge>;
      if (quantity <= min) return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Stock Bajo</Badge>;
      return <Badge variant="success" className="bg-green-100 text-green-700 border-green-200">Saludable</Badge>;
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500">
      
      {/* 1. Dashboard Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#114a28] text-white border-none shadow-lg shadow-green-900/10">
              <CardContent className="p-4 flex justify-between items-center">
                  <div>
                      <p className="text-[10px] uppercase font-bold text-green-300/80 tracking-widest">Valor Total Stock</p>
                      <h4 className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(stats.totalValue)}</h4>
                  </div>
                  <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5" />
                  </div>
              </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-4 flex justify-between items-center">
                  <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Unidades Totales</p>
                      <h4 className="text-2xl font-bold mt-1 text-gray-900">{stats.totalItems}</h4>
                  </div>
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                      <Package className="w-5 h-5" />
                  </div>
              </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-4 flex justify-between items-center">
                  <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Críticos / Bajo</p>
                      <h4 className="text-2xl font-bold mt-1 text-orange-600">{stats.lowStockCount}</h4>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-400">
                      <AlertTriangle className="w-5 h-5" />
                  </div>
              </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-4 flex justify-between items-center">
                  <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Faltantes</p>
                      <h4 className="text-2xl font-bold mt-1 text-red-600">{stats.outOfStockCount}</h4>
                  </div>
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-400">
                      <Trash2 className="w-5 h-5" />
                  </div>
              </CardContent>
          </Card>
      </div>

      {/* 2. Controls & Categories Toolbar */}
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col xl:flex-row gap-4 items-center justify-between">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto w-full xl:w-auto custom-scrollbar">
              {CATEGORIES.map((cat) => (
                  <button
                      key={cat.value}
                      onClick={() => setActiveCategory(cat.value as any)}
                      className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                          activeCategory === cat.value 
                            ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5" 
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                      )}
                  >
                      <cat.icon className={cn("w-3.5 h-3.5", activeCategory === cat.value ? "text-[#114a28]" : "text-gray-400")} />
                      {cat.label}
                  </button>
              ))}
          </div>

          {/* Search & Global Actions */}
          <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Buscar marca, modelo o desc..." 
                    className="pl-9 h-10 text-sm bg-gray-50 border-gray-200"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <Button variant="outline" size="sm" className="h-10 text-gray-600">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Exportar
              </Button>
              <Button className="h-10 bg-[#114a28] hover:bg-[#0e3b20] shadow-md shadow-green-900/10 px-4" onClick={() => setIsAddStockOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Nuevo Artículo
              </Button>
          </div>
      </div>

      {/* 3. Main Inventory Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                      <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <th className="py-4 px-6">Artículo / Categoría</th>
                          <th className="py-4 px-6">Marca & Modelo</th>
                          <th className="py-4 px-6">Descripción</th>
                          <th className="py-4 px-6 text-center">Cantidad</th>
                          <th className="py-4 px-6">Estado</th>
                          <th className="py-4 px-6 text-right">Precio Un.</th>
                          <th className="py-4 px-6 text-center w-20">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {filteredStock.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                                          {item.category === 'Parabrisas' && <Shield className="w-5 h-5" />}
                                          {item.category === 'Lunetas' && <Car className="w-5 h-5" />}
                                          {item.category === 'Escobillas' && <Wind className="w-5 h-5" />}
                                          {item.category === 'Pegamentos' && <Box className="w-5 h-5" />}
                                          {!['Parabrisas', 'Lunetas', 'Escobillas', 'Pegamentos'].includes(item.category) && <Package className="w-5 h-5" />}
                                      </div>
                                      <div className="flex flex-col">
                                          <span className="font-bold text-gray-900">{item.id}</span>
                                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{item.category}</span>
                                      </div>
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  <div className="flex flex-col">
                                      <span className="font-bold text-gray-800">{item.brand}</span>
                                      <span className="text-xs text-gray-500">{item.model}</span>
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  <span className="text-gray-600 text-xs line-clamp-1" title={item.description}>
                                      {item.description}
                                  </span>
                              </td>
                              <td className="py-4 px-6">
                                  <div className="flex items-center justify-center gap-3">
                                      <button className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-500">-</button>
                                      <span className="font-mono font-bold text-base w-8 text-center">{item.quantity}</span>
                                      <button className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-500">+</button>
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  {getStockBadge(item.quantity, item.minStock)}
                              </td>
                              <td className="py-4 px-6 text-right">
                                  <span className="font-mono font-bold text-gray-900">{formatCurrency(item.price || 0)}</span>
                              </td>
                              <td className="py-4 px-6 text-center">
                                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700">
                                      <MoreVertical className="w-4 h-4" />
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {filteredStock.length === 0 && (
                          <tr>
                              <td colSpan={7} className="text-center py-20 text-gray-400">
                                  <div className="flex flex-col items-center">
                                      <Package className="w-12 h-12 mb-3 opacity-20" />
                                      <p className="font-medium text-lg">No se encontraron artículos</p>
                                      <p className="text-sm opacity-70">Intenta cambiar el filtro o el término de búsqueda</p>
                                  </div>
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* 4. Simple Footer Toolbar */}
      <div className="flex justify-between items-center px-2">
           <div className="flex gap-4">
               <div className="flex items-center gap-2 text-xs text-gray-500">
                   <div className="w-2 h-2 rounded-full bg-green-500"></div> Stock OK
               </div>
               <div className="flex items-center gap-2 text-xs text-gray-500">
                   <div className="w-2 h-2 rounded-full bg-orange-500"></div> Bajo Stock
               </div>
               <div className="flex items-center gap-2 text-xs text-gray-500">
                   <div className="w-2 h-2 rounded-full bg-red-500"></div> Crítico
               </div>
           </div>
           <Button className="bg-[#114a28] hover:bg-[#0e3b20] h-10 px-6 font-bold">
               Realizar Inventario <ClipboardList className="w-4 h-4 ml-2" />
           </Button>
      </div>

      {/* --- ADD/EDIT DIALOG --- */}
      <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen} title="Gestión de Artículo">
          <div className="space-y-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categoría</label>
                    <select className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all">
                        {CATEGORIES.filter(c => c.value !== 'all').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Marca</label>
                    <Input placeholder="Ej: FORD, VW, TOYOTA" className="h-11" />
                 </div>
              </div>

              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Modelo / Aplicación</label>
                  <Input placeholder="Ej: RANGER 2023+" className="h-11" />
              </div>

              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descripción Detallada</label>
                  <textarea className="w-full min-h-[100px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all" placeholder="Especificaciones adicionales..."></textarea>
              </div>

              <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cantidad Inicial</label>
                     <Input type="number" defaultValue="0" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Min. Requerido</label>
                     <Input type="number" defaultValue="5" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Precio Estimado</label>
                     <Input placeholder="$ 0,00" className="h-11" />
                  </div>
              </div>

              <div className="flex gap-3 pt-2">
                  <Button variant="ghost" className="flex-1 text-gray-500" onClick={() => setIsAddStockOpen(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-[#114a28] hover:bg-[#0e3b20] font-bold shadow-lg shadow-green-900/10">Guardar Artículo</Button>
              </div>
          </div>
      </Dialog>
    </div>
  );
};