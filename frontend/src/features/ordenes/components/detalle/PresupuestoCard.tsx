import { useState } from 'react';
import { Badge, Button, Card, Form, InputGroup, Stack } from 'react-bootstrap';
import { Link } from 'react-router';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Moneda, Orden } from '@/shared/types';
import { aNumero, formatearMonto, redondear } from '@/shared/utils/dinero';
import * as ordenesApi from '../../api';
import { formularioAPrecios, preciosAFormulario } from '../../precios-form';
import { PreciosAlternativos } from '../PreciosAlternativos';
import type { SeccionOrdenProps } from './tipos';

interface PresupuestoCardProps extends SeccionOrdenProps {
  /** Arma el mensaje con el resultado del aviso al cliente. */
  conAviso: (base: string, orden: ordenesApi.OrdenConNotificacion) => string;
}

/**
 * Precio de lista con su moneda, otros precios, el detalle que lee el cliente, su respuesta y, si ya se
 * entregó, lo cobrado (que puede estar en otra moneda). Después de entregar la
 * moneda del presupuesto ya no se cambia: queda como lo que se le pasó al cliente.
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
  const [detalle, setDetalle] = useState(orden.presupuestoDetalle ?? '');
  const [precios, setPrecios] = useState(() => preciosAFormulario(orden.precios));
  const cobrada = orden.montoTotal != null;
  const { enCurso, ejecutar } = useAccion(onError);

  async function guardar(aprobado?: boolean) {
    let actualizada: ordenesApi.OrdenConNotificacion | undefined;
    const ok = await ejecutar(async () => {
      actualizada = await ordenesApi.actualizarPresupuesto(orden.id, {
        monto: monto.trim() === '' ? null : aNumero(monto),
        moneda,
        detalle: detalle.trim() || null,
        preciosAlternativos: formularioAPrecios(precios),
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
          <Form.Label>Precio de lista</Form.Label>
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
            <Form.Text className="text-muted">Ya se entregó: la moneda del presupuesto no cambia.</Form.Text>
          )}
          <PreciosAlternativos value={precios} onChange={setPrecios} disabled={!puedeEditar} />
        </Form.Group>
        <Form.Group className="mb-2" controlId="presupuesto-detalle">
          <Form.Label>Detalle para el cliente</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            maxLength={2000}
            placeholder="Ej: cambio de módulo de pantalla original, incluye mano de obra y 90 días de garantía"
            value={detalle}
            disabled={!puedeEditar}
            onChange={(e) => setDetalle(e.target.value)}
          />
          <Form.Text className="text-muted">Lo ve en el seguimiento, en el aviso y en el remito.</Form.Text>
        </Form.Group>
        <div className="mb-2">
          Respuesta del cliente: <RespuestaCliente aprobado={orden.presupuestoAprobado} />
        </div>
        <Stack direction="horizontal" gap={2}>
          <Button size="sm" variant="outline-primary" onClick={() => guardar()} disabled={deshabilitado}>
            Guardar presupuesto
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
          Guardar es un presupuesto nuevo: la orden vuelve a presupuestada y espera otra vez la respuesta del
          cliente.
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
  const monedaCobro = orden.monedaCobro ?? orden.moneda;

  return (
    <div className="mt-3 pt-3 border-top small">
      <div className="fw-semibold mb-1">Cobro al entregar</div>
      <div>Total: {formatearMonto(total, monedaCobro)}</div>
      <div>Abonó: {formatearMonto(abonado, monedaCobro)}</div>
      {credito > 0 && (
        <div className="text-success">Saldo a favor aplicado: {formatearMonto(credito, monedaCobro)}</div>
      )}
      {adeudado > 0 && (
        <div className="text-danger">
          Quedó debiendo {formatearMonto(adeudado, monedaCobro)} —{' '}
          <Link to="/cuentas">ver cuenta corriente</Link>
        </div>
      )}
    </div>
  );
}
