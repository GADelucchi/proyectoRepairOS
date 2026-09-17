import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Spinner } from 'react-bootstrap';

function CargandoPantallaCompleta() {
  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <Spinner animation="border" role="status" />
    </div>
  );
}

export function RutaProtegida() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <CargandoPantallaCompleta />;
  if (!usuario) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RutaConSucursal() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <CargandoPantallaCompleta />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (!usuario.sucursalActualId) return <Navigate to="/seleccionar-sucursal" replace />;
  return <Outlet />;
}

export function RutaAdmin() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <CargandoPantallaCompleta />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== 'admin') return <Navigate to="/ordenes" replace />;
  return <Outlet />;
}
