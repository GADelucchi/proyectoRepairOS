import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Spinner } from 'react-bootstrap';
import { Layout } from './components/Layout';
import { RutaProtegida, RutaConSucursal, RutaAdmin } from './routes/guards';
import { LoginPage } from './pages/LoginPage';

// El login entra en el bundle inicial; el resto se carga al navegar, así la
// primera pantalla no arrastra toda la aplicación.
const RegistroPage = lazy(() => import('./pages/RegistroPage').then((m) => ({ default: m.RegistroPage })));
const SeleccionSucursalPage = lazy(() =>
  import('./pages/SeleccionSucursalPage').then((m) => ({ default: m.SeleccionSucursalPage }))
);
const ClientesPage = lazy(() => import('./pages/ClientesPage').then((m) => ({ default: m.ClientesPage })));
const CuentasPage = lazy(() => import('./pages/CuentasPage').then((m) => ({ default: m.CuentasPage })));
const CajaPage = lazy(() => import('./pages/CajaPage').then((m) => ({ default: m.CajaPage })));
const SolicitudesPage = lazy(() =>
  import('./pages/SolicitudesPage').then((m) => ({ default: m.SolicitudesPage }))
);
const EquiposPage = lazy(() => import('./pages/EquiposPage').then((m) => ({ default: m.EquiposPage })));
const OrdenesPage = lazy(() => import('./pages/OrdenesPage').then((m) => ({ default: m.OrdenesPage })));
const OrdenNuevaPage = lazy(() =>
  import('./pages/OrdenNuevaPage').then((m) => ({ default: m.OrdenNuevaPage }))
);
const OrdenDetallePage = lazy(() =>
  import('./pages/OrdenDetallePage').then((m) => ({ default: m.OrdenDetallePage }))
);
const ConfiguracionPage = lazy(() =>
  import('./pages/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage }))
);
const UsuariosPage = lazy(() =>
  import('./pages/admin/UsuariosPage').then((m) => ({ default: m.UsuariosPage }))
);
const SucursalesPage = lazy(() =>
  import('./pages/admin/SucursalesPage').then((m) => ({ default: m.SucursalesPage }))
);

function CargandoRuta() {
  return (
    <div className="d-flex justify-content-center py-5">
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Cargando…</span>
      </Spinner>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<CargandoRuta />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />

        <Route element={<RutaProtegida />}>
          <Route path="/seleccionar-sucursal" element={<SeleccionSucursalPage />} />

          {/* Rutas admin con navbar pero sin requerir sucursal seleccionada */}
          <Route element={<RutaAdmin />}>
            <Route element={<Layout />}>
              <Route path="/admin/usuarios" element={<UsuariosPage />} />
              <Route path="/admin/sucursales" element={<SucursalesPage />} />
            </Route>
          </Route>

          <Route element={<RutaConSucursal />}>
            <Route element={<Layout />}>
              <Route path="/ordenes" element={<OrdenesPage />} />
              <Route path="/ordenes/nueva" element={<OrdenNuevaPage />} />
              <Route path="/ordenes/:id" element={<OrdenDetallePage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/cuentas" element={<CuentasPage />} />
              <Route path="/caja" element={<CajaPage />} />
              <Route path="/autorizaciones" element={<SolicitudesPage />} />
              <Route path="/equipos" element={<EquiposPage />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/ordenes" replace />} />
      </Routes>
    </Suspense>
  );
}
