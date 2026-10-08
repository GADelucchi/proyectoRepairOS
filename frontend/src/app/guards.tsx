import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { Cargando } from '@/shared/components/Cargando';

/**
 * Guardas de ruta. Se anidan: protegida → (con sucursal | admin).
 * Al mandar al login o a elegir sucursal se recuerda la ruta pedida para volver
 * después: es lo que hace que el QR de un equipo, escaneado sin sesión, termine
 * igual en la ficha del equipo.
 */

export function RutaProtegida() {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  if (cargando) return <Cargando pantallaCompleta />;
  if (!usuario) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function RutaConSucursal() {
  const { usuario } = useAuth();
  const location = useLocation();
  if (!usuario?.sucursalActualId) {
    return (
      <Navigate to="/seleccionar-sucursal" replace state={{ from: location.pathname + location.search }} />
    );
  }
  return <Outlet />;
}

/** Administración de la plataforma (todos los talleres). */
export function RutaPlataforma() {
  const { esAdminPlataforma } = useAuth();
  if (!esAdminPlataforma) return <Navigate to="/inicio" replace />;
  return <Outlet />;
}

export function RutaAdmin() {
  const { esAdmin } = useAuth();
  if (!esAdmin) return <Navigate to="/inicio" replace />;
  return <Outlet />;
}
