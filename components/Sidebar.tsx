import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { 
  LayoutDashboard, Receipt, Package, CreditCard, CalendarClock, 
  PieChart, BarChart4, Settings, LogOut 
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface SidebarProps {
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onMobileClose }) => {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const disabledPaths = new Set<string>([
    ROUTES.inventory,
    ROUTES.accounts,
    ROUTES.reports,
    ROUTES.stockReports,
    ROUTES.settings,
  ]);

  const menuItems = [
    { path: ROUTES.dashboard, label: 'Home', icon: LayoutDashboard },
    { path: ROUTES.invoices, label: 'Facturación', icon: Receipt },
    { path: ROUTES.appointments, label: 'Turnos', icon: CalendarClock },
    { path: ROUTES.inventory, label: 'Inventario', icon: Package },
    { path: ROUTES.accounts, label: 'Ctas. Ctes.', icon: CreditCard },
    { path: ROUTES.reports, label: 'Rep. Seguros', icon: PieChart },
    { path: ROUTES.stockReports, label: 'Rep. Stock', icon: BarChart4 },
    { path: ROUTES.settings, label: 'Configuración', icon: Settings },
  ];

  const enabledMenuItems = menuItems.filter((item) => !disabledPaths.has(item.path));
  const disabledMenuItems = menuItems.filter((item) => disabledPaths.has(item.path));

  const handleNavigate = (path: string) => {
    if (disabledPaths.has(path)) return;
    navigate(path);
    onMobileClose?.();
  };

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
        
        {enabledMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isDisabled = false;
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              title={isDisabled ? 'Modulo deshabilitado temporalmente' : undefined}
              className={cn(
                "w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 group relative overflow-hidden",
                isActive
                  ? "text-white" 
                  : isDisabled
                    ? "text-gray-500/60 cursor-not-allowed"
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
                  isActive
                    ? "text-green-400"
                    : isDisabled
                      ? "text-gray-600/70"
                      : "text-gray-500 group-hover:text-green-300"
              )} />
              
              <span className={cn(
                  "relative z-10 transition-transform duration-300",
                  !isActive && !isDisabled && "group-hover:translate-x-1"
              )}>{item.label}</span>

              {isDisabled ? (
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-gray-500/80">
                  Off
                </span>
              ) : null}
            </button>
          );
        })}

        {disabledMenuItems.length > 0 ? (
          <div className="px-3 mb-2 mt-5">
            <p className="text-[10px] font-bold text-gray-500/50 uppercase tracking-[0.15em]">Deshabilitados</p>
          </div>
        ) : null}

        {disabledMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isDisabled = true;
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              title={isDisabled ? 'Modulo deshabilitado temporalmente' : undefined}
              className={cn(
                "w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 group relative overflow-hidden",
                isActive
                  ? "text-white"
                  : "text-gray-500/60 cursor-not-allowed"
              )}
            >
              <item.icon className={cn(
                  "h-4 w-4 mr-3 relative z-10 transition-colors duration-300",
                  isActive
                    ? "text-green-400"
                    : "text-gray-600/70"
              )} />

              <span className={cn("relative z-10 transition-transform duration-300")}>{item.label}</span>

              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-gray-500/80">
                Off
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 mt-auto z-10 relative shrink-0">
        <div className="pt-4 border-t border-white/5">
            <button 
            onClick={logout}
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