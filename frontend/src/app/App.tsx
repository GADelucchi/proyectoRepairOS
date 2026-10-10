import { ComponentType, lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { Cargando } from '@/shared/components/Cargando';
import { Layout } from './Layout';
import { RutaAdmin, RutaConSucursal, RutaPlataforma, RutaProtegida } from './guards';

/** Descargas de todas las páginas diferidas, para adelantarlas con la sesión iniciada. */
const descargas: (() => Promise<unknown>)[] = [];

/**
 * Carga diferida de una página exportada con nombre. El login va en el bundle
 * inicial; el resto se descarga al navegar, así la primera pantalla es liviana.
 */
function diferida<M extends Record<string, unknown>>(importar: () => Promise<M>, nombre: keyof M) {
  descargas.push(importar);
  return lazy(() => importar().then((m) => ({ default: m[nombre] as ComponentType })));
}

/**
 * Con la sesión iniciada, descarga el resto de las páginas cuando el navegador
 * está libre: así pasar de un panel a otro no espera la red.
 */
function usePrecargarPaginas(): void {
  const { usuario } = useAuth();
  useEffect(() => {
    if (!usuario) return;
    const precargar = () => descargas.forEach((descargar) => descargar().catch(() => undefined));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(precargar);
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(precargar, 1500);
    return () => clearTimeout(id);
  }, [usuario]);
}

const RegistroPage = diferida(() => import('@/features/auth/pages/RegistroPage'), 'RegistroPage');
const RecuperarPasswordPage = diferida(
  () => import('@/features/auth/pages/RecuperarPasswordPage'),
  'RecuperarPasswordPage'
);
const RestablecerPasswordPage = diferida(
  () => import('@/features/auth/pages/RestablecerPasswordPage'),
  'RestablecerPasswordPage'
);
const VerificarEmailPage = diferida(
  () => import('@/features/auth/pages/VerificarEmailPage'),
  'VerificarEmailPage'
);
const PortalClientePage = diferida(
  () => import('@/features/portal/pages/PortalClientePage'),
  'PortalClientePage'
);
const SeguimientoPage = diferida(
  () => import('@/features/seguimiento/pages/SeguimientoPage'),
  'SeguimientoPage'
);
const InicioPage = diferida(() => import('@/features/inicio/pages/InicioPage'), 'InicioPage');
const ReportesPage = diferida(() => import('@/features/reportes/pages/ReportesPage'), 'ReportesPage');
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
const EquipoDetallePage = diferida(
  () => import('@/features/equipos/pages/EquipoDetallePage'),
  'EquipoDetallePage'
);
const EscanearQrPage = diferida(() => import('@/features/equipos/pages/EscanearQrPage'), 'EscanearQrPage');
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
const PlataformaPage = diferida(() => import('@/features/plataforma/pages/PlataformaPage'), 'PlataformaPage');

export function App() {
  usePrecargarPaginas();

  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/recuperar" element={<RecuperarPasswordPage />} />
        <Route path="/restablecer" element={<RestablecerPasswordPage />} />
        <Route path="/verificar-email" element={<VerificarEmailPage />} />
        {/* Público: lo abre el cliente con el link o el QR del remito. */}
        <Route path="/seguimiento/:codigo" element={<SeguimientoPage />} />
        <Route path="/cliente/:codigo" element={<PortalClientePage />} />

        <Route element={<RutaProtegida />}>
          <Route path="/seleccionar-sucursal" element={<SeleccionSucursalPage />} />

          <Route element={<Layout />}>
            {/* Administración: con menú, pero sin exigir sucursal (la primera se crea acá). */}
            <Route element={<RutaAdmin />}>
              <Route path="/admin/usuarios" element={<UsuariosPage />} />
              <Route path="/admin/sucursales" element={<SucursalesPage />} />
            </Route>

            {/* Todos los talleres: no depende de la sucursal elegida en el propio. */}
            <Route element={<RutaPlataforma />}>
              <Route path="/plataforma" element={<PlataformaPage />} />
            </Route>

            <Route element={<RutaConSucursal />}>
              <Route path="/inicio" element={<InicioPage />} />
              <Route path="/reportes" element={<ReportesPage />} />
              <Route path="/ordenes" element={<OrdenesPage />} />
              <Route path="/ordenes/nueva" element={<OrdenNuevaPage />} />
              <Route path="/ordenes/:id" element={<OrdenDetallePage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/equipos" element={<EquiposPage />} />
              {/* Adonde lleva el QR de la etiqueta del equipo. */}
              <Route path="/equipos/:id" element={<EquipoDetallePage />} />
              <Route path="/escanear" element={<EscanearQrPage />} />
              <Route path="/cuentas" element={<CuentasPage />} />
              <Route path="/caja" element={<CajaPage />} />
              <Route path="/autorizaciones" element={<SolicitudesPage />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </Suspense>
  );
}
