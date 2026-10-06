import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button, Container, Nav, Navbar } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { AvisoAutorizaciones } from '@/features/solicitudes/components/AvisoAutorizaciones';
import { Logo } from '@/shared/components/Logo';

/** Menú superior y contenedor de las pantallas con sesión iniciada. */
export function Layout() {
  const { usuario, esAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const sucursalActual = usuario?.sucursales.find((s) => s.id === usuario.sucursalActualId);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleCambiarSucursal() {
    navigate('/seleccionar-sucursal?cambiar=true');
  }

  return (
    <>
      <a href="#contenido" className="visually-hidden-focusable p-2">
        Saltar al contenido
      </a>
      <Navbar variant="dark" expand="lg" className="mb-4">
        <Container fluid>
          <Navbar.Brand as={NavLink} to="/ordenes">
            <Logo size={30} />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/ordenes">
                Órdenes
              </Nav.Link>
              <Nav.Link as={NavLink} to="/clientes">
                Clientes
              </Nav.Link>
              <Nav.Link as={NavLink} to="/equipos">
                Equipos
              </Nav.Link>
              <Nav.Link as={NavLink} to="/escanear">
                Escanear QR
              </Nav.Link>
              <Nav.Link as={NavLink} to="/cuentas">
                Cuenta corriente
              </Nav.Link>
              <Nav.Link as={NavLink} to="/caja">
                Caja
              </Nav.Link>
              <Nav.Link as={NavLink} to="/autorizaciones">
                Autorizaciones
                <AvisoAutorizaciones />
              </Nav.Link>
              <Nav.Link as={NavLink} to="/configuracion">
                Configuración
              </Nav.Link>
              {esAdmin && (
                <>
                  <Nav.Link as={NavLink} to="/admin/usuarios">
                    Usuarios
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/admin/sucursales">
                    Sucursales
                  </Nav.Link>
                </>
              )}
            </Nav>
            <Nav className="align-items-lg-center gap-2">
              {sucursalActual && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCambiarSucursal}
                  title="Cambiar de sucursal"
                >
                  {sucursalActual.nombre} (cambiar)
                </Button>
              )}
              <span className="text-light small">
                {usuario?.nombre} {usuario?.apellido}
              </span>
              <Button size="sm" variant="outline-light" onClick={handleLogout}>
                Salir
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container as="main" id="contenido" fluid className="pb-5">
        <Outlet />
      </Container>
    </>
  );
}
