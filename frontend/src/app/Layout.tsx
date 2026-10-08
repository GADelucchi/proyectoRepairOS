import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button, Container, Nav, NavDropdown, Navbar } from 'react-bootstrap';
import { AvisoSuscripcion } from '@/features/auth/components/AvisoSuscripcion';
import { useAuth } from '@/features/auth/useAuth';
import { GuiaInicio } from '@/features/guia/GuiaInicio';
import { abrirGuia } from '@/features/guia/pasos';
import { Campanita } from '@/features/notificaciones/components/Campanita';
import { AjustePlan } from '@/features/plan/AjustePlan';
import { AvisoAutorizaciones } from '@/features/solicitudes/components/AvisoAutorizaciones';
import { Logo } from '@/shared/components/Logo';
import { VolverArriba } from '@/shared/components/VolverArriba';

function IconoQr() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
    </svg>
  );
}

/** Menú superior y contenedor de las pantallas con sesión iniciada. */
export function Layout() {
  const { usuario, esAdmin, esAdminPlataforma, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // En el celular el menú se cierra solo al ir a otra pantalla (incluido "Salir" o cambiar de sucursal).
  const [menuAbierto, setMenuAbierto] = useState(false);
  useEffect(() => setMenuAbierto(false), [location.pathname, location.search]);

  const sucursalActual = usuario?.sucursales.find((s) => s.id === usuario.sucursalActualId);

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

  return (
    <>
      <a href="#contenido" className="visually-hidden-focusable p-2">
        Saltar al contenido
      </a>
      <Navbar variant="dark" expand="lg" className="mb-4" expanded={menuAbierto} onToggle={setMenuAbierto}>
        <Container fluid>
          <Navbar.Brand as={NavLink} to="/inicio">
            <Logo size={30} />
          </Navbar.Brand>
          {/* Fuera del menú colapsable: en el celular quedan a la vista sin abrirlo. */}
          <div className="d-flex align-items-center gap-1 ms-auto me-2 me-lg-0 order-lg-last">
            {usuario?.esDemo && (
              <Button size="sm" className="btn-crear-taller me-1" onClick={handleCrearTaller}>
                Crear mi taller
              </Button>
            )}
            <NavLink
              to="/escanear"
              className="btn btn-link text-light px-2"
              title="Escanear QR de un equipo"
              aria-label="Escanear QR de un equipo"
              data-tour="nav-escanear"
            >
              <IconoQr />
            </NavLink>
            <Campanita />
            <Button
              variant="link"
              className="text-light px-2 fw-bold text-decoration-none"
              onClick={abrirGuia}
              title="Ver la guía"
              aria-label="Ver la guía de uso"
              data-tour="ayuda"
            >
              ?
            </Button>
          </div>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse
            id="main-nav"
            // Tocar un link cierra el menú aunque sea la pantalla en la que ya estás.
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a.nav-link:not(.dropdown-toggle), .dropdown-item')) {
                setMenuAbierto(false);
              }
            }}
          >
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/inicio" data-tour="nav-inicio">
                Inicio
              </Nav.Link>
              <Nav.Link as={NavLink} to="/ordenes" data-tour="nav-ordenes">
                Órdenes
              </Nav.Link>
              <Nav.Link as={NavLink} to="/clientes">
                Clientes
              </Nav.Link>
              <Nav.Link as={NavLink} to="/equipos">
                Equipos
              </Nav.Link>
              <Nav.Link as={NavLink} to="/cuentas" title="Cuenta corriente">
                Cuentas
              </Nav.Link>
              <Nav.Link as={NavLink} to="/caja" data-tour="nav-caja">
                Caja
              </Nav.Link>
              <Nav.Link as={NavLink} to="/reportes" data-tour="nav-reportes">
                Reportes
              </Nav.Link>
              <Nav.Link as={NavLink} to="/autorizaciones">
                Autorizaciones
                <AvisoAutorizaciones />
              </Nav.Link>
              <NavDropdown title={<span data-tour="nav-ajustes">Ajustes</span>} id="menu-ajustes">
                <NavDropdown.Item as={NavLink} to="/configuracion">
                  Configuración
                </NavDropdown.Item>
                {esAdmin && (
                  <>
                    <NavDropdown.Item as={NavLink} to="/admin/usuarios">
                      Usuarios
                    </NavDropdown.Item>
                    <NavDropdown.Item as={NavLink} to="/admin/sucursales">
                      Sucursales
                    </NavDropdown.Item>
                  </>
                )}
                {esAdminPlataforma && (
                  <>
                    <NavDropdown.Divider />
                    <NavDropdown.Item as={NavLink} to="/plataforma">
                      Plataforma
                    </NavDropdown.Item>
                  </>
                )}
              </NavDropdown>
            </Nav>
            {/* Quién está y en qué sucursal: a la vista, pero en un solo renglón. */}
            <Nav>
              <NavDropdown
                align="end"
                id="menu-usuario"
                title={
                  <span className="small">
                    {usuario?.nombre}
                    {sucursalActual && <span className="text-muted"> · {sucursalActual.nombre}</span>}
                  </span>
                }
              >
                <NavDropdown.ItemText className="small text-muted">
                  {usuario?.nombre} {usuario?.apellido}
                  <br />
                  {usuario?.email}
                </NavDropdown.ItemText>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleCambiarSucursal}>Cambiar de sucursal</NavDropdown.Item>
                <NavDropdown.Item onClick={handleLogout}>Salir</NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <GuiaInicio />
      <VolverArriba />
      <Container as="main" id="contenido" fluid className="pb-5">
        {usuario?.excesoDelPlan && !esAdminPlataforma ? (
          // Con el plan excedido no se opera: solo se elige qué queda activo.
          <AjustePlan />
        ) : (
          <>
            {!usuario?.esDemo && <AvisoSuscripcion suscripcion={usuario?.suscripcion ?? null} />}
            <Outlet />
          </>
        )}
      </Container>
    </>
  );
}
