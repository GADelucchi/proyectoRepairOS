import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import * as authApi from '../api/auth';
import { TOKEN_STORAGE_KEY } from '../api/client';
import { RolUsuario, Sucursal, Suscripcion, Taller } from '../types';

interface AuthUser {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  taller: Taller | null;
  suscripcion: Suscripcion | null;
  sucursalActualId: number | null;
  sucursales: Sucursal[];
}

interface AuthContextValue {
  usuario: AuthUser | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  registrar: (datos: authApi.RegistroDatos) => Promise<void>;
  logout: () => void;
  seleccionarSucursal: (sucursalId: number) => Promise<void>;
  refrescar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<AuthUser | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    try {
      const data = await authApi.me();
      setUsuario(data);
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token } = await authApi.login(email, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      await refrescar();
    },
    [refrescar]
  );

  const registrar = useCallback(
    async (datos: authApi.RegistroDatos) => {
      const { token } = await authApi.registrar(datos);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      await refrescar();
    },
    [refrescar]
  );

  const seleccionarSucursal = useCallback(
    async (sucursalId: number) => {
      const { token } = await authApi.seleccionarSucursal(sucursalId);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      // Esperar a que refrescar se complete antes de resolver la promesa
      await refrescar();
    },
    [refrescar]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, login, registrar, logout, seleccionarSucursal, refrescar }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
