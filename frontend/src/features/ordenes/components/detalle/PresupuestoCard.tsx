import { useState } from 'react';
import { Badge, Button, Card, Form, InputGroup, Stack } from 'react-bootstrap';
import { Link } from 'react-router';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Moneda, Orden } from '@/shared/types';
import { aNumero, formatearMonto, redondear } from '@/shared/utils/dinero';
import * as ordenesApi from '../../api';
import type { SeccionOrdenProps } from './tipos';

interface PresupuestoCardProps extends SeccionOrdenProps {
  /** Arma el mensaje con el resultado del aviso al cliente. */
  conAviso: (base: string, orden: ordenesApi.OrdenConNotificacion) => string;
}

/**
 * Monto presupuestado y su moneda, respuesta del cliente y, si ya se entregó, lo
 * cobrado. La moneda es la de la entrega y la cuenta corriente, así que después
 * de cobrar ya no se cambia.
 */
export function PresupuestoCard({
  orden,
  puedeEditar,
  onActualizada,
  onError,
  conAviso
}: PresupuestoCardProps) {
  // Arranca con el monto y la moneda guardados. El padre la vuelve a montar (con `key`)
  // cuando cambian, así lo que el usuario está tipeando nunca se pisa con una recarga.
  const [monto, setMonto] = useState(() =>
    orden.presupuestoMonto != null ? String(orden.presupuestoMonto) : ''
  );
  const [moneda, setMoneda] = useState<Moneda>(orden.moneda);
  const cobrada = orden.montoTotal != null;
  const { enCurso, ejecutar } = useAccion(onError);

  async function guardar(aprobado?: boolean) {
    let actualizada: ordenesApi.OrdenConNotificacion | undefined;
    const ok = await ejecutar(async () => {
      actualizada = await ordenesApi.actualizarPresupuesto(orden.id, {
        monto: monto.trim() === '' ? null : aNumero(monto),
        moneda,
        aprobado
      });
    }, 'No se pudo actualizar el presupuesto');
    if (ok && actualizada) onActualizada(conAviso('Presupuesto actualizado.', actualizada));
  }

  const deshabilitado = enCurso || !puedeEditar;

  return (
    <Card className="h-100">
      <Card.Header>Presupuesto</Card.Header>
      <Card.Body>
        <Form.Group className="mb-2" controlId="presupuesto-monto">
          <Form.Label>Monto</Form.Label>
          <InputGroup>
            <SelectorMoneda value={moneda} onChange={setMoneda} disabled={!puedeEditar || cobrada} />
            <Form.Control
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={monto}
              disabled={!puedeEditar}
              onChange={(e) => setMonto(e.target.value)}
            />
          </InputGroup>
          {cobrada && (
            <Form.Text className="text-muted">Ya se cobró en {orden.moneda}: la moneda no cambia.</Form.Text>
          )}
        </Form.Group>
        <div className="mb-2">
          Respuesta del cliente: <RespuestaCliente aprobado={orden.presupuestoAprobado} />
        </div>
        <Stack direction="horizontal" gap={2}>
          <Button size="sm" variant="outline-primary" onClick={() => guardar()} disabled={deshabilitado}>
            Guardar monto
          </Button>
          <Button size="sm" variant="success" onClick={() => guardar(true)} disabled={deshabilitado}>
            Cliente aprobó
          </Button>
          <Button size="sm" variant="danger" onClick={() => guardar(false)} disabled={deshabilitado}>
            Cliente rechazó
          </Button>
        </Stack>
        {orden.montoTotal != null && <CobroAlEntregar orden={orden} />}
        <Form.Text className="text-muted d-block mt-2">
          Guardar el monto deja la orden como presupuestada.
        </Form.Text>
      </Card.Body>
    </Card>
  );
}

function RespuestaCliente({ aprobado }: { aprobado?: boolean | null }) {
  if (aprobado === true) return <Badge bg="success">Aprobado</Badge>;
  if (aprobado === false) return <Badge bg="danger">Rechazado</Badge>;
  return <Badge bg="secondary">Pendiente</Badge>;
}

function CobroAlEntregar({ orden }: { orden: Orden }) {
  const total = aNumero(orden.montoTotal);
  const abonado = aNumero(orden.montoAbonado);
  const credito = aNumero(orden.creditoAplicado);
  const adeudado = redondear(total - abonado - credito);

  return (
    <div className="mt-3 pt-3 border-top small">
      <div className="fw-semibold mb-1">Cobro al entregar</div>
      <div>Total: {formatearMonto(total, orden.moneda)}</div>
      <div>Abonó: {formatearMonto(abonado, orden.moneda)}</div>
      {credito > 0 && (
        <div className="text-success">Saldo a favor aplicado: {formatearMonto(credito, orden.moneda)}</div>
      )}
      {adeudado > 0 && (
        <div className="text-danger">
          Quedó debiendo {formatearMonto(adeudado, orden.moneda)} —{' '}
          <Link to="/cuentas">ver cuenta corriente</Link>
        </div>
      )}
    </div>
  );
}
