import { useEffect, useState } from 'react';
import { Alert, Card, Container, Spinner } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router';
import { getApiErrorMessage } from '@/shared/api/client';
import { Logo } from '@/shared/components/Logo';
import * as authApi from '../api';

/** Confirma el email con el link que llegó al registrarse. */
export function VerificarEmailPage() {
  const token = useSearchParams()[0].get('token') ?? '';
  const [estado, setEstado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setEstado({ ok: false, mensaje: 'Falta el código del link. Abrí el link completo del email.' });
      return;
    }
    let vigente = true;
    authApi
      .verificarEmail(token)
      .then(({ email }) => vigente && setEstado({ ok: true, mensaje: `Confirmamos ${email}.` }))
      .catch(
        (err) =>
          vigente &&
          setEstado({ ok: false, mensaje: getApiErrorMessage(err, 'No se pudo confirmar el email') })
      );
    return () => {
      vigente = false;
    };
  }, [token]);

  return (
    <Container className="d-flex justify-content-center align-items-center vh-100">
      <Card style={{ width: 400 }} className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-center mb-3">
            <Logo size={44} />
          </div>
          {!estado ? (
            <div className="text-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <Alert variant={estado.ok ? 'success' : 'danger'} className="mb-0">
              {estado.mensaje}{' '}
              {estado.ok ? (
                <Link to="/login">Ingresar</Link>
              ) : (
                'Desde el ingreso podés pedir que te lo mandemos de nuevo.'
              )}
            </Alert>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
