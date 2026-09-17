import { NavLink, Outlet, useNavigate } from 'react-router';
import { Container, Nav, Navbar, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { AvisoAutorizaciones } from './AvisoAutorizaciones';

export function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const sucursalActual = usuario?.sucursales.find((s) => s.id === usuario.sucursalActualId);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleCambiarSucursal() {
    // Ir a cambiar sucursal - usamos un parámetro de búsqueda para indicar que estamos en modo cambio
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
              {usuario?.rol === 'admin' && (
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
                <Badge
                  bg="secondary"
                  role="button"
                  className="text-decoration-none"
                  onClick={handleCambiarSucursal}
                  style={{ cursor: 'pointer' }}
                >
                  {sucursalActual.nombre} (cambiar)
                </Badge>
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
