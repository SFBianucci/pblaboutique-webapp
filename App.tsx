import React, { useState } from 'react';
import { View } from './types';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { Inventory } from './pages/Inventory';
import { Appointments } from './pages/Appointments';
import { Accounts } from './pages/Accounts';

function App() {
  const [currentView, setCurrentView] = useState<View>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Estado para manejar la navegación directa a una factura
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentView('dashboard');
  };

  const handleNavigate = (view: View) => {
    if (view === 'login') {
      setIsAuthenticated(false);
    }
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

  if (!isAuthenticated || currentView === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  return (
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
  );
}

export default App;