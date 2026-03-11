import React from 'react';
import { cn } from '../lib/utils';
import { View } from '../types';
import { 
  LayoutDashboard, Receipt, Package, CreditCard, CalendarClock, 
  PieChart, BarChart4, Settings, LogOut 
} from 'lucide-react';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'invoices', label: 'Facturación', icon: Receipt },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'accounts', label: 'Ctas. Ctes.', icon: CreditCard },
    { id: 'appointments', label: 'Turnos', icon: CalendarClock },
    { id: 'reports', label: 'Rep. Seguros', icon: PieChart },
    { id: 'stock-reports', label: 'Rep. Stock', icon: BarChart4 },
    { id: 'abm', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a1f11] text-gray-300 relative overflow-hidden font-sans">
      {/* Background Decor - Ambient Light */}
      <div className="absolute -top-20 -left-20 w-60 h-60 bg-green-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-1/2 -right-20 w-40 h-40 bg-green-400/5 rounded-full blur-[60px] pointer-events-none" />

      {/* Brand Section */}
      <div className="relative h-24 flex items-center px-5 z-10 shrink-0">
        <div className="flex items-center gap-3.5 group cursor-default w-full">
            <div className="w-9 h-9 bg-gradient-to-br from-green-600 to-green-800 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/50 border border-green-500/30 group-hover:shadow-green-900/80 transition-all duration-500">
                <span className="text-white font-black italic text-lg drop-shadow-md">B</span>
            </div>
            <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-white leading-none">Bouticapp</span>
                <span className="text-[10px] font-medium text-green-400/70 tracking-wide mt-1">Gestión Integral</span>
            </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar z-10">
        <div className="px-3 mb-3 mt-1">
             <p className="text-[10px] font-bold text-green-500/50 uppercase tracking-[0.15em]">Menu Principal</p>
        </div>
        
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as View)}
              className={cn(
                "w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 group relative overflow-hidden",
                isActive
                  ? "text-white" 
                  : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
              )}
            >
              {/* Active State Background & Indicator */}
              {isActive && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-transparent opacity-100" />
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-green-500 rounded-r-full shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
                </>
              )}

              <item.icon className={cn(
                  "h-4 w-4 mr-3 relative z-10 transition-colors duration-300",
                  isActive ? "text-green-400" : "text-gray-500 group-hover:text-green-300"
              )} />
              
              <span className={cn(
                  "relative z-10 transition-transform duration-300",
                  !isActive && "group-hover:translate-x-1"
              )}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 mt-auto z-10 relative shrink-0">
        <div className="pt-4 border-t border-white/5">
            <button 
            onClick={() => onNavigate('login')}
            className="w-full flex items-center px-3 py-2.5 text-xs font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 group"
            >
            <LogOut className="h-4 w-4 mr-3 group-hover:-translate-x-1 transition-transform" />
            Cerrar Sesión
            </button>
            <div className="flex justify-center mt-4">
               <span className="text-[10px] text-gray-700 font-mono tracking-widest opacity-50">v2.5.0</span>
            </div>
        </div>
      </div>
    </div>
  );
};