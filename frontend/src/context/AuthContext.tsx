import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, login as loginService, logout as logoutService } from '../services/authService';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  employeeId?: string;
  hourlyRate?: number;
  status?: string;
  workMode?: 'WFO' | 'WFH' | 'HYBRID';
  isSsc?: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, location?: { latitude?: number; longitude?: number }) => Promise<any>;
  logout: () => void;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('shero_user');
      const token = localStorage.getItem('token');
      return token && cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await getCurrentUser();
          setUser(userData);
          localStorage.setItem('shero_user', JSON.stringify(userData));
        } catch (error: any) {
          console.error("Auth init verify:", error);
          if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('shero_user');
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string, location?: { latitude?: number; longitude?: number }) => {
    const data = await loginService(email, password, location);
    setUser(data.user);
    localStorage.setItem('shero_user', JSON.stringify(data.user));
    return data;
  };

  const logout = () => {
    logoutService();
    localStorage.removeItem('shero_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


