import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  login: (token: string, user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('bouticapp_token');
    localStorage.removeItem('bouticapp_user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    // Restaurar sesión desde localStorage al cargar la app
    const storedToken = localStorage.getItem('bouticapp_token');
    const storedUser = localStorage.getItem('bouticapp_user');

    if (storedToken && storedUser) {
      if (isTokenExpired(storedToken)) {
        // Token vencido: limpiar y no autenticar
        localStorage.removeItem('bouticapp_token');
        localStorage.removeItem('bouticapp_user');
      } else {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    }
    setIsLoading(false);
  }, []);

  // Auto-logout cuando el token expira mientras la app está abierta
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const msUntilExpiry = payload.exp * 1000 - Date.now();
      if (msUntilExpiry <= 0) {
        logout();
        return;
      }
      const timer = setTimeout(logout, msUntilExpiry);
      return () => clearTimeout(timer);
    } catch {
      logout();
    }
  }, [token, logout]);

  const login = (newToken: string, newUser: any) => {
    localStorage.setItem('bouticapp_token', newToken);
    localStorage.setItem('bouticapp_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setIsAuthenticated(true);
  };

  if (isLoading) {
    // Evita renderizar la app mientras verificamos el localStorage
    return null; 
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
