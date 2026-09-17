import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../api/client';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (usuario) {
      navigate((location.state as any)?.from ?? '/seleccionar-sucursal', { replace: true });
    }
  }, [usuario, navigate, location.state]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      navigate('/seleccionar-sucursal', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo iniciar sesión'));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Container className="d-flex justify-content-center align-items-center vh-100">
      <Card style={{ width: 380 }} className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-center mb-3">
            <Logo size={44} />
          </div>
          <Card.Subtitle className="mb-4 text-center text-muted">Ingreso de técnicos</Card.Subtitle>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>
            <Button type="submit" className="w-100" disabled={cargando}>
              {cargando ? <Spinner size="sm" animation="border" /> : 'Ingresar'}
            </Button>
          </Form>
          <p className="text-center text-muted small mt-3 mb-0">
            ¿No tenés cuenta? <Link to="/registro">Creá tu taller</Link>
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}
