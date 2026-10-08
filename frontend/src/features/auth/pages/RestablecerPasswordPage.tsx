import { FormEvent, useState } from 'react';
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router';
import { getApiErrorMessage } from '@/shared/api/client';
import { Logo } from '@/shared/components/Logo';
import * as authApi from '../api';
import { PasswordFields } from '../components/PasswordFields';
import { passwordListo } from '../password';

/** Elige la contraseña nueva con el link que llegó por email. */
export function RestablecerPasswordPage() {
  const token = useSearchParams()[0].get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await authApi.restablecerPassword(token, password, confirmacion);
      setListo(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Container className="d-flex justify-content-center align-items-center vh-100">
      <Card style={{ width: 400 }} className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-center mb-3">
            <Logo size={44} />
          </div>
          <Card.Subtitle className="mb-3 text-center text-muted">Contraseña nueva</Card.Subtitle>

          {!token ? (
            <Alert variant="danger">
              Falta el código del link. Abrí el link completo del email o{' '}
              <Link to="/recuperar">pedí uno nuevo</Link>.
            </Alert>
          ) : listo ? (
            <Alert variant="success">
              Listo, ya podés <Link to="/login">ingresar con tu contraseña nueva</Link>.
            </Alert>
          ) : (
            <Form onSubmit={handleSubmit}>
              {error && (
                <Alert variant="danger">
                  {error} <Link to="/recuperar">Pedir otro link</Link>
                </Alert>
              )}
              <PasswordFields
                password={password}
                confirmacion={confirmacion}
                onPasswordChange={setPassword}
                onConfirmacionChange={setConfirmacion}
                disabled={cargando}
                label="Contraseña nueva"
              />
              <Button
                type="submit"
                className="w-100 mt-3"
                disabled={cargando || !passwordListo(password, confirmacion)}
              >
                {cargando ? <Spinner size="sm" animation="border" /> : 'Guardar contraseña'}
              </Button>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
