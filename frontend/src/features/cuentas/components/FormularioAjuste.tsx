import { FormEvent, useState } from 'react';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { AlertaError } from '@/shared/components/AlertaError';
import { useAccion } from '@/shared/hooks/useAccion';
import { aNumero } from '@/shared/utils/dinero';
import * as cuentasApi from '../api';

interface FormularioAjusteProps {
  clienteId: number;
  esAdmin: boolean;
  onListo: (aplicada: boolean) => void;
}

/**
 * Pedido de ajuste sobre la cuenta.
 *
 * Corregir un saldo no es cobrar: no entró ni salió plata, cambia lo que el
 * cliente debe. Por eso cualquiera lo puede pedir pero solo un admin lo aplica,
 * y el motivo es obligatorio porque es lo único que va a leer quien apruebe.
 */
export function FormularioAjuste({ clienteId, esAdmin, onListo }: FormularioAjusteProps) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState('');
  const [direccion, setDireccion] = useState<'debito' | 'credito'>('credito');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enCurso: enviando, ejecutar } = useAccion(setError);

  const montoNumero = aNumero(monto);
  const listo = montoNumero > 0 && motivo.trim() !== '';

  async function handleEnviar(e: FormEvent) {
    e.preventDefault();
    let aplicada = false;
    const ok = await ejecutar(async () => {
      ({ aplicada } = await cuentasApi.solicitarAjuste(clienteId, {
        monto: montoNumero,
        direccion,
        motivo: motivo.trim()
      }));
    }, 'No se pudo pedir el ajuste');
    if (ok) {
      setAbierto(false);
      setMonto('');
      setMotivo('');
      onListo(aplicada);
    }
  }

  if (!abierto) {
    return (
      <Button size="sm" variant="outline-secondary" className="mt-3" onClick={() => setAbierto(true)}>
        {esAdmin ? 'Ajustar saldo' : 'Solicitar ajuste de saldo'}
      </Button>
    );
  }

  return (
    <Card className="mt-3">
      <Card.Header>{esAdmin ? 'Ajustar saldo' : 'Solicitar ajuste de saldo'}</Card.Header>
      <Card.Body>
        <AlertaError error={error} />
        <Form onSubmit={handleEnviar}>
          <Row className="g-2">
            <Col sm={4}>
              <Form.Group controlId="ajuste-monto">
                <Form.Label>Monto</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  disabled={enviando}
                  autoFocus
                />
              </Form.Group>
            </Col>
            <Col sm={8}>
              <Form.Group controlId="ajuste-direccion">
                <Form.Label>Qué hace</Form.Label>
                <Form.Select
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value as 'debito' | 'credito')}
                  disabled={enviando}
                >
                  <option value="credito">Descontar de lo que debe (a favor del cliente)</option>
                  <option value="debito">Sumar a lo que debe</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mt-2" controlId="ajuste-motivo">
            <Form.Label>Motivo</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: se cargó de más el repuesto en la orden ORD-000012"
              disabled={enviando}
            />
            <Form.Text className="text-muted">
              {esAdmin
                ? 'Se aplica en el acto y queda registrado que lo autorizaste.'
                : 'Lo va a leer quien apruebe. El saldo cambia recién cuando lo autoricen.'}
            </Form.Text>
          </Form.Group>
          <div className="d-flex gap-2 mt-3">
            <Button type="submit" size="sm" disabled={enviando || !listo}>
              {enviando ? <Spinner size="sm" animation="border" /> : esAdmin ? 'Aplicar' : 'Enviar pedido'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
