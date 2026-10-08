import { useContext } from 'react';
import { MONEDA_POR_DEFECTO } from '@/shared/constants/monedas';
import type { Moneda } from '@/shared/types';
import { AuthContext, AuthContextValue } from './auth-context';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

/** Moneda por defecto del taller (según su país). Pesos argentinos si todavía no cargó el perfil. */
export function useMonedaDelTaller(): Moneda {
  return useAuth().usuario?.taller?.moneda ?? MONEDA_POR_DEFECTO;
}
