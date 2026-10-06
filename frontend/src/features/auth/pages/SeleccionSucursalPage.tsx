import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { getApiErrorMessage } from '@/shared/api/client';
import { useAuth } from '../useAuth';

/**
 * Segundo paso del login: elegir desde qué sucursal se trabaja.
 * Con `?cambiar=true` se llega desde el menú para cambiar de sucursal.
 */
export function SeleccionSucursalPage() {
  const { usuario, seleccionarSucursal, cargando, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Si se llegó acá desde un link (por ejemplo, el QR de un equipo), se vuelve a él.
  const destino = (useLocation().state as { from?: string } | null)?.from ?? '/ordenes';
  const [error, setError] = useState<string | null>(null);
  const [seleccionando, setSeleccionando] = useState<number | null>(null);

  const cambiandoSucursal = searchParams.get('cambiar') === 'true';

  // Si ya hay una sucursal válida elegida (y no se vino a cambiarla), no hay nada que hacer acá.
  useEffect(() => {
    if (!cargando && usuario?.sucursalActualId && !cambiandoSucursal) {
      navigate(destino, { replace: true });
    }
  }, [cargando, usuario, cambiandoSucursal, navigate, destino]);

  async function handleSeleccionar(sucursalId: number) {
    setError(null);
    setSeleccionando(sucursalId);
    try {
      await seleccionarSucursal(sucursalId);
      navigate(destino, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo seleccionar la sucursal'));
    } finally {
      setSeleccionando(null);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleCrearSucursal() {
    navigate('/admin/sucursales');
  }

  if (cargando) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }

  const sucursales = usuario?.sucursales ?? [];

  return (
    <Container className="py-5" style={{ maxWidth: 700 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">¿En qué sucursal vas a trabajar?</h2>
        <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
      <p className="text-muted mb-4">Seleccioná la sucursal para continuar. Podrás cambiarla luego.</p>
      {error && <Alert variant="danger">{error}</Alert>}
      {sucursales.length === 0 && (
        <Card>
          <Card.Body className="text-center">
            <Alert variant="warning" className="mb-3">
              No tenés sucursales asignadas.
            </Alert>
            {usuario?.rol === 'admin' ? (
              <>
                <p className="text-muted mb-3">Como administrador, podés crear una sucursal.</p>
                <Button variant="primary" onClick={handleCrearSucursal}>
                  + Crear sucursal
                </Button>
              </>
            ) : (
              <p className="text-muted">Contactá a un administrador para que te asigne una.</p>
            )}
          </Card.Body>
        </Card>
      )}
      <Row xs={1} md={2} className="g-3">
        {sucursales.map((s) => (
          <Col key={s.id}>
            <Card
              className="h-100 shadow-sm"
              role="button"
              onClick={() => handleSeleccionar(s.id)}
              style={{ cursor: 'pointer' }}
            >
              <Card.Body>
                <Card.Title>{s.nombre}</Card.Title>
                {s.direccion && <Card.Text className="text-muted">{s.direccion}</Card.Text>}
                <Button variant="primary" disabled={seleccionando === s.id}>
                  {seleccionando === s.id ? <Spinner size="sm" animation="border" /> : 'Ingresar'}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
}
