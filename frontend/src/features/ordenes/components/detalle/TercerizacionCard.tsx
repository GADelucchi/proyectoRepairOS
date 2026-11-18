import { useState } from 'react';
import { Badge, Button, Card, Form, ListGroup, Spinner } from 'react-bootstrap';
import { ExternalLink } from 'lucide-react';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useAccion } from '@/shared/hooks/useAccion';
import type { EstadoTercerizacion, Moneda, Tercerizacion } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import { formatearFecha } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as ordenesApi from '../../api';
import { urlDeSeguimiento } from '../../aviso-cliente';
import { EstadoBadge } from '../EstadoBadge';

const ETIQUETA_ENVIO: Record<EstadoTercerizacion, { texto: string; clase: string }> = {
  enviada: { texto: 'Afuera', clase: 'badge-teal' },
  recibida: { texto: 'Lo recibió', clase: 'badge-teal' },
  devuelta: { texto: 'Volvió', clase: 'badge-gris' },
  cancelada: { texto: 'Cancelado', clase: 'badge-red' }
};

/** "Enviado el 3/11 · recibido el 4/11 · volvió el 9/11". */
function fechasDelEnvio(t: Tercerizacion): string {
  return [
    `Enviado el ${formatearFecha(t.createdAt)}`,
    t.recibidaEn && `recibido el ${formatearFecha(t.recibidaEn)}`,
    t.devueltaEn && `volvió el ${formatearFecha(t.devueltaEn)}`,
    t.canceladaEn && `cancelado el ${formatearFecha(t.canceladaEn)}`
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * A quién se mandó el equipo. Si el destino usa RepairOS, se ve en qué anda su
 * orden y el link de seguimiento de ese taller (con su presupuesto, si lo cargó).
 * Solo lo ve el taller: el cliente sigue viendo "En reparación".
 */
export function TercerizacionCard({
  ordenId,
  tercerizaciones,
  esAdmin,
  monedaLocal,
  onActualizada,
  onError
}: {
  ordenId: number;
  tercerizaciones: Tercerizacion[];
  esAdmin: boolean;
  monedaLocal: Moneda;
  onActualizada: (mensaje?: string) => void;
  onError: (mensaje: string) => void;
}) {
  return (
    <Card>
      <Card.Header>Taller externo</Card.Header>
      <ListGroup variant="flush">
        {tercerizaciones.map((t) => {
          const envio = ETIQUETA_ENVIO[t.estado];
          const contacto = [t.dniCuit && `DNI/CUIT ${t.dniCuit}`, t.direccion].filter(Boolean).join(' · ');
          return (
            <ListGroup.Item key={t.id}>
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <div className="min-w-0">
                  <strong>{t.nombre}</strong>
                  {t.enRepairOS && <Badge className="badge-violet ms-2">RepairOS</Badge>}
                  {contacto && <div className="small text-muted">{contacto}</div>}
                  <div className="small">
                    {t.telefono && <a href={`tel:${t.telefono.replace(/[^\d+]/g, '')}`}>{t.telefono}</a>}
                    {t.telefono && t.email && ' · '}
                    {t.email && <a href={`mailto:${t.email}`}>{t.email}</a>}
                  </div>
                </div>
                <Badge className={envio.clase}>{envio.texto}</Badge>
              </div>

              <div className="small mt-2" style={{ whiteSpace: 'pre-line' }}>
                <span className="text-muted">Trabajo: </span>
                {t.trabajo}
              </div>

              {t.ordenDestino && (
                <div className="small mt-2 d-flex align-items-center gap-2 flex-wrap">
                  <span className="text-muted">Su orden</span>
                  <span className="font-mono">{t.ordenDestino.numeroOrden}</span>
                  <EstadoBadge estado={t.ordenDestino.estado} />
                  {t.ordenDestino.codigoSeguimiento && (
                    <a
                      href={urlDeSeguimiento(t.ordenDestino.codigoSeguimiento)}
                      target="_blank"
                      rel="noreferrer"
                      className="d-inline-flex align-items-center gap-1"
                    >
                      Ver su seguimiento <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}

              <div className="text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                {fechasDelEnvio(t)}
                {t.enviadaPor && ` · por ${nombreCompleto(t.enviadaPor)}`}
              </div>

              {esAdmin && t.estado !== 'cancelada' && (
                <CostoExterno
                  ordenId={ordenId}
                  tercerizacion={t}
                  monedaLocal={monedaLocal}
                  onActualizada={onActualizada}
                  onError={onError}
                />
              )}
            </ListGroup.Item>
          );
        })}
      </ListGroup>
    </Card>
  );
}

/**
 * Lo que cobró el externo por el trabajo (solo admin): suma al costo de la
 * orden en el informe de reparaciones. Se carga al mandarlo o cuando vuelve.
 */
function CostoExterno({
  ordenId,
  tercerizacion: t,
  monedaLocal,
  onActualizada,
  onError
}: {
  ordenId: number;
  tercerizacion: Tercerizacion;
  monedaLocal: Moneda;
  onActualizada: (mensaje?: string) => void;
  onError: (mensaje: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [moneda, setMoneda] = useState<Moneda>(t.costo?.moneda ?? monedaLocal);
  const [monto, setMonto] = useState(t.costo ? String(t.costo.monto) : '');
  const [cotizacion, setCotizacion] = useState(t.costo?.cotizacion ? String(t.costo.cotizacion) : '');
  const { enCurso, ejecutar } = useAccion(onError);

  async function guardar() {
    if (aNumero(monto) < 0 || monto.trim() === '') return onError('Indicá cuánto cobró.');
    if (moneda !== 'USD' && aNumero(cotizacion) <= 0) return onError('Indicá la cotización del dólar.');
    const ok = await ejecutar(
      () =>
        ordenesApi.guardarCostoExterno(ordenId, t.id, {
          moneda,
          monto: aNumero(monto),
          cotizacion: moneda === 'USD' ? null : aNumero(cotizacion)
        }),
      'No se pudo guardar el costo'
    );
    if (ok) {
      setEditando(false);
      onActualizada('Costo del externo guardado.');
    }
  }

  if (!editando) {
    return (
      <div className="small mt-2 d-flex align-items-center gap-2 flex-wrap border-top pt-2">
        <span className="text-muted">Cuánto cobró:</span>
        {t.costo ? (
          <strong>
            {formatearMonto(t.costo.monto, t.costo.moneda)}
            {t.costo.moneda !== 'USD' && t.costo.usd != null && ` (${formatearMonto(t.costo.usd, 'USD')})`}
          </strong>
        ) : (
          <span className="text-muted">sin cargar</span>
        )}
        <Button size="sm" variant="link" className="p-0" onClick={() => setEditando(true)}>
          {t.costo ? 'Cambiar' : 'Cargar'}
        </Button>
        <span className="badge badge-gris">Solo admins</span>
      </div>
    );
  }

  return (
    <div className="mt-2 border-top pt-2">
      <div className="small mb-1">Cuánto cobró el externo (suma al costo de la orden)</div>
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <SelectorMoneda value={moneda} onChange={setMoneda} />
        <Form.Control
          size="sm"
          style={{ maxWidth: 140 }}
          inputMode="decimal"
          aria-label="Monto que cobró el externo"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        {moneda !== 'USD' && (
          <Form.Control
            size="sm"
            style={{ maxWidth: 140 }}
            inputMode="decimal"
            aria-label="Cotización del dólar"
            placeholder={`${moneda} por US$ 1`}
            value={cotizacion}
            onChange={(e) => setCotizacion(e.target.value)}
          />
        )}
        <Button size="sm" onClick={guardar} disabled={enCurso}>
          {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
        </Button>
        <Button size="sm" variant="outline-secondary" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
