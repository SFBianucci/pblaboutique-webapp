import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface AppDataType {
  notasExpress: any[];
  tipoFactura: any[];
  seguros: any[];
  resumenFactura: any[];
  tipoStock: any[];
  turnos: any[];
  semanaAux: string;
}

interface AppDataContextType {
  appData: AppDataType | null;
  isInitializingData: boolean;
  errorInitializing: string | null;
  refreshAppData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  
  const [appData, setAppData] = useState<AppDataType | null>(null);
  const [isInitializingData, setIsInitializingData] = useState<boolean>(false);
  const [errorInitializing, setErrorInitializing] = useState<string | null>(null);

  const fetchInitData = async () => {
    if (!token) return;
    
    setIsInitializingData(true);
    setErrorInitializing(null);

    try {
      const response = await fetch('/api/init-data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('No se pudo inicializar la información base.');
      }

      const result = await response.json();
      
      if (result.success) {
        setAppData({
          notasExpress: result.notasExpress || [],
          tipoFactura: result.tipoFactura || [],
          seguros: result.seguros || [],
          resumenFactura: result.resumenFactura || [],
          tipoStock: result.tipoStock || [],
          turnos: result.turnos || [],
          semanaAux: result.semanaAux || ''
        });
      } else {
        throw new Error(result.error || 'Server error on init data');
      }

    } catch (error: any) {
      console.error('AppData Init Error:', error);
      setErrorInitializing(error.message);
    } finally {
      setIsInitializingData(false);
    }
  };

  useEffect(() => {
    // Cuando el usuario se autentica (sea porque hizo login o porque restauro la sesion)
    // disparamos la carga de datos inicial si todavia no la tenemos.
    if (isAuthenticated && token && !appData && !isInitializingData) {
      fetchInitData();
    }
    
    if (!isAuthenticated) {
      // Limpiamos la memoria de la aplicacion al cerrar sesion
      setAppData(null);
    }
  }, [isAuthenticated, token]);

  const refreshAppData = async () => {
    await fetchInitData();
  };

  return (
    <AppDataContext.Provider value={{ appData, isInitializingData, errorInitializing, refreshAppData }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
