import { useState } from 'react';
import { Badge, Button, Card, Form, Stack } from 'react-bootstrap';
import { Link } from 'react-router';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Orden } from '@/shared/types';
import { aNumero, formatearMonto, redondear } from '@/shared/utils/dinero';
import * as ordenesApi from '../../api';
import type { SeccionOrdenProps } from './tipos';

interface PresupuestoCardProps extends SeccionOrdenProps {
  /** Arma el mensaje con el resultado del aviso al cliente. */
  conAviso: (base: string, orden: ordenesApi.OrdenConNotificacion) => string;
}

/** Monto presupuestado, respuesta del cliente y, si ya se entregó, lo cobrado. */
export function PresupuestoCard({
  orden,
  puedeEditar,
  onActualizada,
  onError,
  conAviso
}: PresupuestoCardProps) {
  // Arranca con el monto guardado. El padre la vuelve a montar (con `key`) cuando ese
  // monto cambia, así lo que el usuario está tipeando nunca se pisa con una recarga.
  const [monto, setMonto] = useState(() =>
    orden.presupuestoMonto != null ? String(orden.presupuestoMonto) : ''
  );
  const { enCurso, ejecutar } = useAccion(onError);

  async function guardar(aprobado?: boolean) {
    let actualizada: ordenesApi.OrdenConNotificacion | undefined;
    const ok = await ejecutar(async () => {
      actualizada = await ordenesApi.actualizarPresupuesto(orden.id, {
        monto: monto.trim() === '' ? null : aNumero(monto),
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
          <Form.Control
            type="number"
            min={0}
            step="0.01"
            value={monto}
            disabled={!puedeEditar}
            onChange={(e) => setMonto(e.target.value)}
          />
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
      <div>Total: {formatearMonto(total)}</div>
      <div>Abonó: {formatearMonto(abonado)}</div>
      {credito > 0 && <div className="text-success">Saldo a favor aplicado: {formatearMonto(credito)}</div>}
      {adeudado > 0 && (
        <div className="text-danger">
          Quedó debiendo {formatearMonto(adeudado)} — <Link to="/cuentas">ver cuenta corriente</Link>
        </div>
      )}
    </div>
  );
}
