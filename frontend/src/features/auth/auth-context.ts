import { createContext } from 'react';
import type { Perfil, RegistroDatos } from './api';

export interface AuthContextValue {
  usuario: Perfil | null;
  cargando: boolean;
  esAdmin: boolean;
  esAdminPlataforma: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** `verificacionPendiente`: la cuenta se creó pero hay que confirmar el email antes de entrar. */
  registrar: (datos: RegistroDatos) => Promise<{ verificacionPendiente: boolean }>;
  logout: () => void;
  seleccionarSucursal: (sucursalId: number) => Promise<void>;
  refrescar: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
