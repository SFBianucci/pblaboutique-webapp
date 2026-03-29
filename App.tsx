import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { Inventory } from './pages/Inventory';
import { Appointments } from './pages/Appointments';
import { Accounts } from './pages/Accounts';
import { StockReports } from './pages/StockReports';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AppDataProvider, useAppData } from './lib/AppDataContext';
import { ROUTES } from './lib/routes';
import { Loader2 } from 'lucide-react';

const ComingSoon = () => (
  <div className="flex flex-col items-center justify-center h-full text-gray-500">
    <h2 className="text-2xl font-bold mb-2">Próximamente</h2>
    <p>Esta sección se encuentra en desarrollo.</p>
  </div>
);

const ModuleDisabled = () => (
  <div className="flex flex-col items-center justify-center h-full text-gray-500">
    <h2 className="text-2xl font-bold mb-2">Módulo deshabilitado</h2>
    <p>Esta sección está temporalmente fuera de servicio.</p>
  </div>
);

function AuthenticatedApp() {
  const { isInitializingData, errorInitializing } = useAppData();

  return (
    <div className="relative min-h-screen">
      {/* Loading Overlay */}
      {isInitializingData && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-300">
           <div className="bg-white/90 p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[240px] w-full mx-4 border border-white/20">
              <Loader2 className="w-8 h-8 text-[#113123] animate-spin mb-3" />
              <h2 className="text-[#113123] text-lg font-bold mb-1 tracking-tight">Sincronizando...</h2>
              <p className="text-gray-600 text-[10px] text-center leading-relaxed">
                Preparando tu espacio de trabajo. 🚀
              </p>
           </div>
        </div>
      )}

      {/* Error State */}
      {errorInitializing ? (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl text-center max-w-md w-full shadow-xl border border-red-100 italic">
            <h2 className="text-red-700 font-bold mb-4 text-xl">Error de Sincronización</h2>
            <p className="text-gray-600 mb-6 text-sm">{errorInitializing}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 w-full shadow-lg shadow-red-200"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
            <Route path={ROUTES.dashboard} element={<Dashboard />} />
            <Route path={ROUTES.invoices} element={<Invoices />} />
            <Route path={ROUTES.inventory} element={<Inventory />} />
            <Route path={ROUTES.appointments} element={<Appointments />} />
            <Route path={ROUTES.accounts} element={<Accounts />} />
            <Route path={ROUTES.reports} element={<ModuleDisabled />} />
            <Route path={ROUTES.stockReports} element={<StockReports />} />
            <Route path={ROUTES.settings} element={<ModuleDisabled />} />
            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Route>
        </Routes>
      )}
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path={ROUTES.login} element={<Login />} />
        <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
      </Routes>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppDataProvider>
    </AuthProvider>
  );
}

export default App;
