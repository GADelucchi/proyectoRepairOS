import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { getApiErrorMessage } from '@/shared/api/client';
import { Logo } from '@/shared/components/Logo';
import { URL_PRIVACIDAD, URL_TERMINOS, URL_TRATAMIENTO_DATOS } from '@/shared/constants/legales';
import { PasswordFields } from '../components/PasswordFields';
import { passwordListo } from '../password';
import { useAuth } from '../useAuth';

/**
 * Alta de un taller nuevo.
 *
 * Quien completa este formulario queda como administrador del taller que crea:
 * después elige el plan y da de alta su primera sucursal.
 */
export function RegistroPage() {
  const { registrar, usuario } = useAuth();
  const navigate = useNavigate();

  const [nombreTaller, setNombreTaller] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmacion, setPasswordConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (usuario) navigate('/seleccionar-sucursal', { replace: true });
  }, [usuario, navigate]);

  const completo =
    nombreTaller.trim() !== '' &&
    nombre.trim() !== '' &&
    apellido.trim() !== '' &&
    email.trim() !== '' &&
    passwordListo(password, passwordConfirmacion);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await registrar({
        nombreTaller: nombreTaller.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        password,
        passwordConfirmacion
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo crear la cuenta'));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Container className="py-5 d-flex justify-content-center">
      <Card style={{ width: 460 }} className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-center mb-3">
            <Logo size={44} />
          </div>
          <Card.Subtitle className="mb-2 text-center text-muted">Creá tu taller</Card.Subtitle>
          <p className="text-center text-muted small mb-4">
            El primer mes es de prueba. Elegís el plan después, sin cargar una tarjeta ahora.
          </p>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Nombre del taller</Form.Label>
              <Form.Control
                value={nombreTaller}
                onChange={(e) => setNombreTaller(e.target.value)}
                maxLength={150}
                required
                autoFocus
                disabled={cargando}
              />
              <Form.Text className="text-muted">Es el nombre que van a ver tus técnicos.</Form.Text>
            </Form.Group>

            <Row>
              <Col sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nombre</Form.Label>
                  <Form.Control
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    maxLength={100}
                    required
                    disabled={cargando}
                  />
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Apellido</Form.Label>
                  <Form.Control
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    maxLength={100}
                    required
                    disabled={cargando}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={150}
                autoComplete="username"
                required
                disabled={cargando}
              />
              <Form.Text className="text-muted">Con este email vas a ingresar al sistema.</Form.Text>
            </Form.Group>

            <PasswordFields
              password={password}
              confirmacion={passwordConfirmacion}
              onPasswordChange={setPassword}
              onConfirmacionChange={setPasswordConfirmacion}
              disabled={cargando}
            />

            <p className="text-muted small mt-3 mb-0">
              Al crear la cuenta aceptás los{' '}
              <a href={URL_TERMINOS} target="_blank" rel="noopener noreferrer">
                Términos y Condiciones
              </a>
              , la{' '}
              <a href={URL_PRIVACIDAD} target="_blank" rel="noopener noreferrer">
                Política de Privacidad
              </a>{' '}
              y el{' '}
              <a href={URL_TRATAMIENTO_DATOS} target="_blank" rel="noopener noreferrer">
                Acuerdo de Tratamiento de Datos
              </a>
              .
            </p>

            <Button type="submit" className="w-100 mt-3" disabled={cargando || !completo}>
              {cargando ? <Spinner size="sm" animation="border" /> : 'Crear cuenta'}
            </Button>
          </Form>

          <p className="text-center text-muted small mt-3 mb-0">
            ¿Ya tenés cuenta? <Link to="/login">Ingresá</Link>
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}
