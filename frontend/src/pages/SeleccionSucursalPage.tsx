import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../api/client';

export function SeleccionSucursalPage() {
  const { usuario, seleccionarSucursal, cargando, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [seleccionando, setSeleccionando] = useState<number | null>(null);

  const esModosCambio = searchParams.get('cambiar') === 'true';

  useEffect(() => {
    // Solo redirigir a /ordenes si:
    // 1. No estamos cargando
    // 2. Ya hay una sucursal seleccionada
    // 3. NO estamos en modo cambio
    // 4. La sucursal actual existe en la lista de sucursales disponibles
    if (!cargando && usuario?.sucursalActualId && !esModosCambio) {
      if (usuario.sucursales.some((s) => s.id === usuario.sucursalActualId)) {
        navigate('/ordenes', { replace: true });
      }
    }
  }, [cargando, usuario, esModosCambio, navigate]);

  async function handleSeleccionar(sucursalId: number) {
    setError(null);
    setSeleccionando(sucursalId);
    try {
      await seleccionarSucursal(sucursalId);
      // Esperar un tick para asegurar que el estado se actualizó
      await new Promise((resolve) => setTimeout(resolve, 0));
      navigate('/ordenes', { replace: true });
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
                <p className="text-muted mb-3">Como administrador, puedes crear una nueva sucursal.</p>
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
