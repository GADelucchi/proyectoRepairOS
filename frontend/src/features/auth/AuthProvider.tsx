import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { EVENTO_PLAN_EXCEDIDO, sesion } from '@/shared/api/client';
import * as authApi from './api';
import { AuthContext, AuthContextValue } from './auth-context';

/**
 * Sesión del usuario.
 *
 * El token vive en localStorage; el perfil (rol, taller, sucursales) se pide a
 * la API al arrancar y después de cada cambio de token, así la pantalla nunca
 * confía en datos viejos guardados en el navegador.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<authApi.Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    if (!sesion.token()) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    try {
      setUsuario(await authApi.perfil());
    } catch {
      sesion.cerrar();
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
    window.addEventListener(EVENTO_PLAN_EXCEDIDO, refrescar);
    return () => window.removeEventListener(EVENTO_PLAN_EXCEDIDO, refrescar);
  }, [refrescar]);

  /** Guarda el token nuevo y recarga el perfil con lo que dice la API. */
  const iniciarCon = useCallback(
    async (token: string) => {
      sesion.guardar(token);
      await refrescar();
    },
    [refrescar]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      cargando,
      esAdmin: usuario?.rol === 'admin',
      esAdminPlataforma: usuario?.esAdminPlataforma ?? false,
      refrescar,
      login: async (email, password) => iniciarCon((await authApi.login(email, password)).token),
      registrar: async (datos) => {
        const respuesta = await authApi.registrar(datos);
        if ('verificacionPendiente' in respuesta) return { verificacionPendiente: true };
        await iniciarCon(respuesta.token);
        return { verificacionPendiente: false };
      },
      seleccionarSucursal: async (sucursalId) =>
        iniciarCon((await authApi.seleccionarSucursal(sucursalId)).token),
      logout: () => {
        sesion.cerrar();
        setUsuario(null);
      }
    }),
    [usuario, cargando, refrescar, iniciarCon]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
