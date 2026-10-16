import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button, Offcanvas } from 'react-bootstrap';
import { CircleHelp, Menu, Moon, PanelLeft, ScanLine, Sun } from 'lucide-react';
import { AvisoSuscripcion } from '@/features/auth/components/AvisoSuscripcion';
import { useAuth } from '@/features/auth/useAuth';
import { GuiaInicio } from '@/features/guia/GuiaInicio';
import { abrirGuia } from '@/features/guia/pasos';
import { Campanita } from '@/features/notificaciones/components/Campanita';
import { AjustePlan } from '@/features/plan/AjustePlan';
import { Cargando } from '@/shared/components/Cargando';
import { Logo } from '@/shared/components/Logo';
import { VolverArriba } from '@/shared/components/VolverArriba';
import { useTema } from '@/shared/hooks/useTema';
import { MenuLateral } from './MenuLateral';
import { ITEMS_MENU, itemsAjustes, seccionActual } from './menu';

const CLAVE_MENU_OCULTO = 'repairos_menu_oculto';

function leerMenuOculto(): boolean {
  try {
    return localStorage.getItem(CLAVE_MENU_OCULTO) === '1';
  } catch {
    return false;
  }
}

/**
 * Estructura de las pantallas con sesión iniciada: menú lateral, encabezado
 * con las acciones rápidas y el contenido.
 *
 * En la compu el menú queda fijo a la izquierda y se puede esconder; en el
 * celular se abre como panel desde el botón ☰.
 */
export function Layout() {
  const { usuario, esAdmin, esAdminPlataforma, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tema, alternar: alternarTema } = useTema();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuOculto, setMenuOculto] = useState(leerMenuOculto);

  // En el celular el menú se cierra solo al ir a otra pantalla (incluido "Salir" o cambiar de sucursal).
  useEffect(() => setMenuAbierto(false), [location.pathname, location.search]);

  const titulo = seccionActual(location.pathname, [
    ...ITEMS_MENU,
    ...itemsAjustes(esAdmin, esAdminPlataforma)
  ]);

  function alternarMenuOculto() {
    const nuevo = !menuOculto;
    setMenuOculto(nuevo);
    try {
      localStorage.setItem(CLAVE_MENU_OCULTO, nuevo ? '1' : '0');
    } catch {
      // Sin almacenamiento vale hasta recargar.
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleCambiarSucursal() {
    navigate('/seleccionar-sucursal?cambiar=true');
  }

  /** Desde la demo: se sale del taller de ejemplo y se va a crear el propio. */
  function handleCrearTaller() {
    logout();
    navigate('/registro');
  }

  const menu = (
    <MenuLateral
      onNavegar={() => setMenuAbierto(false)}
      onCambiarSucursal={handleCambiarSucursal}
      onSalir={handleLogout}
    />
  );

  return (
    <div className={`app-shell ${menuOculto ? 'menu-oculto' : ''}`}>
      <a href="#contenido" className="visually-hidden-focusable p-2">
        Saltar al contenido
      </a>

      {/* Primero el de la compu: la guía señala el primer elemento que encuentra. */}
      <aside className="app-sidebar d-none d-lg-flex">{menu}</aside>
      <Offcanvas
        show={menuAbierto}
        onHide={() => setMenuAbierto(false)}
        className="d-lg-none"
        style={{ width: 280 }}
        aria-label="Menú principal"
      >
        <Offcanvas.Body className="p-0 d-flex">{menu}</Offcanvas.Body>
      </Offcanvas>

      <div className="app-contenido">
        <header className="app-topbar">
          <button
            type="button"
            className="btn-icono d-lg-none"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir el menú"
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            className="btn-icono d-none d-lg-inline-grid"
            onClick={alternarMenuOculto}
            aria-label={menuOculto ? 'Mostrar el menú' : 'Esconder el menú'}
            title={menuOculto ? 'Mostrar el menú' : 'Esconder el menú'}
          >
            <PanelLeft size={18} />
          </button>
          <NavLink to="/inicio" className="d-lg-none text-reset text-decoration-none" aria-label="Inicio">
            <Logo size={26} showText={false} />
          </NavLink>
          {titulo && (
            <span className="app-topbar-titulo d-none d-sm-inline border-start ps-3 ms-1">{titulo}</span>
          )}

          <div className="d-flex align-items-center gap-1 ms-auto">
            {usuario?.esDemo && (
              <Button size="sm" className="btn-crear-taller me-1" onClick={handleCrearTaller}>
                Crear mi taller
              </Button>
            )}
            <NavLink
              to="/escanear"
              className="btn-icono"
              title="Escanear QR de un equipo"
              aria-label="Escanear QR de un equipo"
              data-tour="nav-escanear"
            >
              <ScanLine size={18} />
            </NavLink>
            <Campanita />
            <button
              type="button"
              className="btn-icono"
              onClick={alternarTema}
              title={tema === 'oscuro' ? 'Pasar al tema claro' : 'Pasar al tema oscuro'}
              aria-label={tema === 'oscuro' ? 'Pasar al tema claro' : 'Pasar al tema oscuro'}
            >
              {tema === 'oscuro' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="btn-icono"
              onClick={abrirGuia}
              title="Ver la guía"
              aria-label="Ver la guía de uso"
              data-tour="ayuda"
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>

        <GuiaInicio />
        <VolverArriba />
        <main id="contenido" className="app-main">
          {usuario?.excesoDelPlan && !esAdminPlataforma ? (
            // Con el plan excedido no se opera: solo se elige qué queda activo.
            <AjustePlan />
          ) : (
            <>
              {!usuario?.esDemo && <AvisoSuscripcion suscripcion={usuario?.suscripcion ?? null} />}
              {/* La página se descarga sin tapar el menú. */}
              <Suspense fallback={<Cargando />}>
                <Outlet />
              </Suspense>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
