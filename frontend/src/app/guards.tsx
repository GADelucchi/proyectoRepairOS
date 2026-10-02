import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { Cargando } from '@/shared/components/Cargando';

/**
 * Guardas de ruta. Se anidan: protegida → (con sucursal | admin).
 * Al mandar al login se recuerda la ruta pedida para volver después.
 */

export function RutaProtegida() {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  if (cargando) return <Cargando pantallaCompleta />;
  if (!usuario) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RutaConSucursal() {
  const { usuario } = useAuth();
  if (!usuario?.sucursalActualId) return <Navigate to="/seleccionar-sucursal" replace />;
  return <Outlet />;
}

export function RutaAdmin() {
  const { esAdmin } = useAuth();
  if (!esAdmin) return <Navigate to="/ordenes" replace />;
  return <Outlet />;
}
