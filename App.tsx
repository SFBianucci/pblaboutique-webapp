import React, { useState } from 'react';
import { View } from './types';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { Inventory } from './pages/Inventory';
import { Appointments } from './pages/Appointments';
import { Accounts } from './pages/Accounts';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AppDataProvider, useAppData } from './lib/AppDataContext';
import { Loader2 } from 'lucide-react'; // Using Lucide for the spinner

function MainApp() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { isAuthenticated } = useAuth();
  const { isInitializingData, errorInitializing } = useAppData();
  
  // Estado para manejar la navegación directa a una factura
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Forzar vuelta al dashboard al logearse
  React.useEffect(() => {
    if (isAuthenticated) {
        setCurrentView('dashboard');
    }
  }, [isAuthenticated]);

  const handleNavigate = (view: View) => {
    // Limpiamos la selección si cambiamos de vista manualmente
    if (view !== 'invoices') {
        setSelectedInvoiceId(null);
    }
    setCurrentView(view);
  };

  const handleNavigateToInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    setCurrentView('invoices');
  };

  if (!isAuthenticated) {
    return <Login />;
  }

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
        <Layout currentView={currentView} onNavigate={handleNavigate}>
      {currentView === 'dashboard' && (
        <Dashboard onNavigateToInvoice={handleNavigateToInvoice} />
      )}
      {currentView === 'invoices' && (
        <Invoices 
            initialInvoiceId={selectedInvoiceId} 
            onClearSelection={() => setSelectedInvoiceId(null)}
        />
      )}
      {currentView === 'inventory' && <Inventory />}
      {currentView === 'appointments' && <Appointments />}
      {currentView === 'accounts' && <Accounts />}
      
      {(currentView === 'reports' || currentView === 'stock-reports' || currentView === 'abm') && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
           <h2 className="text-2xl font-bold mb-2">Próximamente</h2>
           <p>Esta sección se encuentra en desarrollo.</p>
        </div>
      )}
      </Layout>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <MainApp />
      </AppDataProvider>
    </AuthProvider>
  );
}

export default App;