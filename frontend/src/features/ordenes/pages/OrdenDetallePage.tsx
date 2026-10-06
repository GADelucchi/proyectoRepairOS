import { useCallback, useState } from 'react';
import { Alert, Button, Col, Row, Spinner, Stack } from 'react-bootstrap';
import { Link, useLocation, useParams } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Moneda } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import * as ordenesApi from '../api';
import { ChequeosCard } from '../components/detalle/ChequeosCard';
import { ClienteCard } from '../components/detalle/ClienteCard';
import { DetallesCard } from '../components/detalle/DetallesCard';
import { EquipoCard } from '../components/detalle/EquipoCard';
import { EstadoCard } from '../components/detalle/EstadoCard';
import { FirmaCard } from '../components/detalle/FirmaCard';
import { HistorialCard } from '../components/detalle/HistorialCard';
import { ImagenesCard } from '../components/detalle/ImagenesCard';
import { PresupuestoCard } from '../components/detalle/PresupuestoCard';
import { EntregaModal, ResultadoEntrega } from '../components/EntregaModal';
import { EstadoBadge } from '../components/EstadoBadge';
import { esEstadoFinal, ETIQUETA_ESTADO } from '../estado-orden';

/** Agrega al mensaje lo que realmente pasó con el aviso al cliente. */
function conAviso(base: string, orden: ordenesApi.OrdenConNotificacion): string {
  return orden.notificacion ? `${base} ${orden.notificacion.detalle}` : base;
}

function mensajeDeEntrega(
  { saldoCliente, creditoAplicado = 0, notificacion }: ResultadoEntrega,
  moneda: Moneda
): string {
  const m = (valor: number) => formatearMonto(valor, moneda);
  const base =
    saldoCliente > 0
      ? `Equipo entregado. El cliente queda debiendo ${m(saldoCliente)}.`
      : saldoCliente < 0
        ? `Equipo entregado. Le quedan ${m(Math.abs(saldoCliente))} a favor.`
        : 'Equipo entregado y cobrado.';
  const credito = creditoAplicado > 0 ? ` Se aplicaron ${m(creditoAplicado)} de saldo a favor.` : '';
  return `${base}${credito}${notificacion ? ` ${notificacion.detalle}` : ''}`;
}

/**
 * Detalle de una orden. Cada tarjeta resuelve su propia parte (presupuesto,
 * estado, firma…) y avisa acá cuando cambió algo, para recargar la orden.
 */
export function OrdenDetallePage() {
  const id = Number(useParams<{ id: string }>().id);
  const { esAdmin } = useAuth();
  // La orden nueva puede llegar con un aviso (por ejemplo, fotos que no se subieron).
  const avisoInicial = (useLocation().state as { aviso?: string } | null)?.aviso ?? null;

  const {
    datos: orden,
    cargando,
    error: errorCarga,
    recargar
  } = useConsulta(() => ordenesApi.obtenerOrden(id), [id], 'No se pudo cargar la orden');
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(avisoInicial);
  const [entregando, setEntregando] = useState(false);
  const { enCurso: descargando, ejecutar } = useAccion(setError);

  const onActualizada = useCallback(
    (texto?: string) => {
      setError(null);
      if (texto) setMensaje(texto);
      recargar();
    },
    [recargar]
  );

  if (cargando && !orden) return <Cargando />;
  if (!orden) return <Alert variant="danger">{errorCarga ?? 'Orden no encontrada'}</Alert>;

  const cerrada = esEstadoFinal(orden.estado);
  const seccion = { orden, puedeEditar: !cerrada || esAdmin, onActualizada, onError: setError };

  const { id: ordenId, numeroOrden } = orden;

  async function descargarPdf() {
    await ejecutar(async () => {
      const url = URL.createObjectURL(await ordenesApi.descargarPdf(ordenId));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${numeroOrden}.pdf`;
      enlace.click();
      // Se libera después: revocarla en el mismo instante cancela la descarga en Safari y Firefox.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }, 'No se pudo descargar el PDF');
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-0 font-mono">Orden {orden.numeroOrden}</h3>
          <EstadoBadge estado={orden.estado} className="mt-1" />
        </div>
        <Stack direction="horizontal" gap={2}>
          <Link className="btn btn-outline-secondary" to="/ordenes">
            Volver
          </Link>
          <Button variant="outline-secondary" onClick={descargarPdf} disabled={descargando}>
            {descargando ? <Spinner size="sm" animation="border" /> : 'Descargar PDF'}
          </Button>
        </Stack>
      </div>

      {cerrada && (
        <Alert variant="secondary" className="py-2">
          Esta orden está <strong>{ETIQUETA_ESTADO[orden.estado].toLowerCase()}</strong> y no admite más
          cambios de estado.
          {esAdmin && ' Como administrador podés seguir editando sus datos.'}
        </Alert>
      )}

      <AlertaError error={error} onCerrar={() => setError(null)} />
      {mensaje && (
        <Alert variant="success" dismissible onClose={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}

      <Row className="g-3">
        <Col md={6}>
          <ClienteCard cliente={orden.cliente} />
        </Col>
        <Col md={6}>
          <EquipoCard orden={orden} onError={setError} />
        </Col>
        <Col md={12}>
          <DetallesCard {...seccion} />
        </Col>
        <Col md={12}>
          <ImagenesCard {...seccion} />
        </Col>
        <Col md={12}>
          <ChequeosCard {...seccion} />
        </Col>
        <Col md={6}>
          <PresupuestoCard
            key={`${orden.presupuestoMonto}-${orden.moneda}`}
            {...seccion}
            conAviso={conAviso}
          />
        </Col>
        <Col md={6}>
          <EstadoCard
            orden={orden}
            esAdmin={esAdmin}
            onActualizada={onActualizada}
            onError={setError}
            onEntregar={() => setEntregando(true)}
            conAviso={conAviso}
          />
        </Col>
        <Col md={6}>
          <FirmaCard {...seccion} />
        </Col>
        <Col md={6}>
          <HistorialCard historial={orden.historialEstados ?? []} />
        </Col>
      </Row>

      <EntregaModal
        orden={orden}
        show={entregando}
        esAdmin={esAdmin}
        onCerrar={() => setEntregando(false)}
        onEntregado={(resultado) => {
          setEntregando(false);
          onActualizada(mensajeDeEntrega(resultado, orden.moneda));
        }}
        onAutorizacionPedida={() => {
          setEntregando(false);
          onActualizada(
            'Pedido enviado. El equipo se entrega cuando un supervisor lo autorice; podés seguirlo en Autorizaciones.'
          );
        }}
      />
    </div>
  );
}
