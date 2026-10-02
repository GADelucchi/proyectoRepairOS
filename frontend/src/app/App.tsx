import { ComponentType, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { Cargando } from '@/shared/components/Cargando';
import { Layout } from './Layout';
import { RutaAdmin, RutaConSucursal, RutaProtegida } from './guards';

/**
 * Carga diferida de una página exportada con nombre. El login va en el bundle
 * inicial; el resto se descarga al navegar, así la primera pantalla es liviana.
 */
function diferida<M extends Record<string, unknown>>(importar: () => Promise<M>, nombre: keyof M) {
  return lazy(() => importar().then((m) => ({ default: m[nombre] as ComponentType })));
}

const RegistroPage = diferida(() => import('@/features/auth/pages/RegistroPage'), 'RegistroPage');
const SeleccionSucursalPage = diferida(
  () => import('@/features/auth/pages/SeleccionSucursalPage'),
  'SeleccionSucursalPage'
);
const OrdenesPage = diferida(() => import('@/features/ordenes/pages/OrdenesPage'), 'OrdenesPage');
const OrdenNuevaPage = diferida(() => import('@/features/ordenes/pages/OrdenNuevaPage'), 'OrdenNuevaPage');
const OrdenDetallePage = diferida(
  () => import('@/features/ordenes/pages/OrdenDetallePage'),
  'OrdenDetallePage'
);
const ClientesPage = diferida(() => import('@/features/clientes/pages/ClientesPage'), 'ClientesPage');
const EquiposPage = diferida(() => import('@/features/equipos/pages/EquiposPage'), 'EquiposPage');
const CuentasPage = diferida(() => import('@/features/cuentas/pages/CuentasPage'), 'CuentasPage');
const CajaPage = diferida(() => import('@/features/caja/pages/CajaPage'), 'CajaPage');
const SolicitudesPage = diferida(
  () => import('@/features/solicitudes/pages/SolicitudesPage'),
  'SolicitudesPage'
);
const ConfiguracionPage = diferida(
  () => import('@/features/configuracion/pages/ConfiguracionPage'),
  'ConfiguracionPage'
);
const UsuariosPage = diferida(() => import('@/features/admin/pages/UsuariosPage'), 'UsuariosPage');
const SucursalesPage = diferida(() => import('@/features/admin/pages/SucursalesPage'), 'SucursalesPage');

export function App() {
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />

        <Route element={<RutaProtegida />}>
          <Route path="/seleccionar-sucursal" element={<SeleccionSucursalPage />} />

          <Route element={<Layout />}>
            {/* Administración: con menú, pero sin exigir sucursal (la primera se crea acá). */}
            <Route element={<RutaAdmin />}>
              <Route path="/admin/usuarios" element={<UsuariosPage />} />
              <Route path="/admin/sucursales" element={<SucursalesPage />} />
            </Route>

            <Route element={<RutaConSucursal />}>
              <Route path="/ordenes" element={<OrdenesPage />} />
              <Route path="/ordenes/nueva" element={<OrdenNuevaPage />} />
              <Route path="/ordenes/:id" element={<OrdenDetallePage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/equipos" element={<EquiposPage />} />
              <Route path="/cuentas" element={<CuentasPage />} />
              <Route path="/caja" element={<CajaPage />} />
              <Route path="/autorizaciones" element={<SolicitudesPage />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/ordenes" replace />} />
      </Routes>
    </Suspense>
  );
}
