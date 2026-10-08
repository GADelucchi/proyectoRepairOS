import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Container, Form, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router';
import { avisoLogin, ErrorApi, getApiErrorData } from '@/shared/api/client';
import { EnlacesLegales } from '@/shared/components/EnlacesLegales';
import { Logo } from '@/shared/components/Logo';
import { ErrorDeIngreso } from '../components/ErrorDeIngreso';
import { useAuth } from '../useAuth';

/**
 * Credenciales del taller de demostración pública.
 *
 * Van por variable de entorno y no hardcodeadas para que el bloque de demo
 * aparezca solo en el despliegue público: un taller que instale el sistema por
 * su cuenta no tiene por qué ver un botón que invita a entrar a otra cuenta.
 * Si falta cualquiera de las dos, el bloque no se muestra.
 */
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL ?? '';
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? '';
const demoDisponible = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

/** Adónde volver después del login: la ruta que se quiso abrir sin sesión, si hubo una. */
interface EstadoLogin {
  from?: string;
}

export function LoginPage() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Si se llegó acá por una salida forzada (suscripción vencida), se explica por qué.
  const [error, setError] = useState<ErrorApi | null>(avisoLogin.leer);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (usuario) {
      navigate((location.state as EstadoLogin | null)?.from ?? '/seleccionar-sucursal', { replace: true });
    }
  }, [usuario, navigate, location.state]);

  /**
   * Recibe las credenciales por parámetro en vez de leer el estado: el botón de
   * demo las completa y entra en el mismo gesto, y el `setState` todavía no se
   * habría aplicado al momento de llamar a `login`.
   */
  async function iniciarSesion(correo: string, clave: string) {
    setError(null);
    setCargando(true);
    try {
      // La redirección la hace el efecto de arriba, cuando el perfil ya está cargado.
      await login(correo, clave);
    } catch (err) {
      setError(getApiErrorData(err, 'No se pudo iniciar sesión'));
    } finally {
      setCargando(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await iniciarSesion(email, password);
  }

  async function entrarComoDemo() {
    // Se completan igual los campos, así queda a la vista con qué usuario entró.
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    await iniciarSesion(DEMO_EMAIL, DEMO_PASSWORD);
  }

  return (
    <Container className="d-flex justify-content-center align-items-center vh-100">
      <Card style={{ width: 380 }} className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-center mb-3">
            <Logo size={44} />
          </div>
          <Card.Subtitle className="mb-4 text-center text-muted">Ingreso de técnicos</Card.Subtitle>
          {error && <ErrorDeIngreso error={error} />}
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
            <div className="text-center mt-2">
              <Link to="/recuperar" state={{ email }} className="small">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </Form>

          {demoDisponible && (
            <div className="border rounded bg-light p-3 mt-4">
              <p className="small text-muted mb-2">
                ¿Querés probarlo sin crear una cuenta? Entrá al taller de demostración.
              </p>
              <dl className="small mb-2 row g-0">
                <dt className="col-5 fw-normal text-muted">Usuario</dt>
                <dd className="col-7 mb-1 text-break">
                  <code>{DEMO_EMAIL}</code>
                </dd>
                <dt className="col-5 fw-normal text-muted">Contraseña</dt>
                <dd className="col-7 mb-0">
                  <code>{DEMO_PASSWORD}</code>
                </dd>
              </dl>
              <Button
                variant="outline-secondary"
                size="sm"
                className="w-100"
                onClick={entrarComoDemo}
                disabled={cargando}
              >
                Entrar a la demo
              </Button>
              <p className="small text-muted mb-0 mt-2">
                Son datos de ejemplo y se restauran cada tanto, así que podés tocar lo que quieras.
              </p>
            </div>
          )}

          <p className="text-center text-muted small mt-3 mb-0">
            ¿No tenés cuenta? <Link to="/registro">Creá tu taller</Link>
          </p>
          <EnlacesLegales />
        </Card.Body>
      </Card>
    </Container>
  );
}
