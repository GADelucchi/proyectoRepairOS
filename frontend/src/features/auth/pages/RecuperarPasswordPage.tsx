import { FormEvent, useState } from 'react';
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap';
import { Link, useLocation } from 'react-router';
import { getApiErrorMessage } from '@/shared/api/client';
import { Logo } from '@/shared/components/Logo';
import * as authApi from '../api';

/** Pide el link para elegir una contraseña nueva. */
export function RecuperarPasswordPage() {
  const emailInicial = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(emailInicial);
  const [resultado, setResultado] = useState<'enviado' | 'sin_email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { emailHabilitado } = await authApi.recuperarPassword(email.trim());
      setResultado(emailHabilitado ? 'enviado' : 'sin_email');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo pedir el link'));
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
          <Card.Subtitle className="mb-3 text-center text-muted">Recuperar la contraseña</Card.Subtitle>

          {resultado === 'enviado' ? (
            <Alert variant="success">
              Si <strong>{email}</strong> tiene una cuenta, te mandamos un link para elegir una contraseña
              nueva. Vale por una hora; revisá también la carpeta de spam.
            </Alert>
          ) : resultado === 'sin_email' ? (
            <Alert variant="warning">
              El envío de emails todavía no está activo, así que el link no te va a llegar. Pedile al
              administrador de tu taller que te cambie la contraseña desde <strong>Usuarios</strong>.
            </Alert>
          ) : (
            <Form onSubmit={handleSubmit}>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form.Group className="mb-3" controlId="recuperar-email">
                <Form.Label>Email de tu cuenta</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </Form.Group>
              <Button type="submit" className="w-100" disabled={cargando}>
                {cargando ? <Spinner size="sm" animation="border" /> : 'Mandarme el link'}
              </Button>
            </Form>
          )}

          <p className="text-center small mt-3 mb-0">
            <Link to="/login">Volver al ingreso</Link>
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}
