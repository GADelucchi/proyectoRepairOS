import { createContext } from 'react';
import type { Perfil, RegistroDatos } from './api';

export interface AuthContextValue {
  usuario: Perfil | null;
  cargando: boolean;
  esAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  registrar: (datos: RegistroDatos) => Promise<void>;
  logout: () => void;
  seleccionarSucursal: (sucursalId: number) => Promise<void>;
  refrescar: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
