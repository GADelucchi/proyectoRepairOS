import { useState } from 'react';
import { Button, Card, Col, Form, ListGroup, Modal, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router';
import * as inventarioApi from '@/features/inventario/api';
import { BADGE_TIPO, ETIQUETA_TIPO, textoCostoUnitario } from '@/features/inventario/inventario';
import { CampoEscaneable } from '@/shared/components/CampoEscaneable';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { ArticuloResumen, RepuestoEnOrden } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFecha } from '@/shared/utils/fechas';
import * as ordenesApi from '../../api';
import type { SeccionOrdenProps } from './tipos';

interface RepuestosCardProps extends SeccionOrdenProps {
  esAdmin: boolean;
}

/**
 * Los servicios y repuestos del inventario puestos en la orden. Al agregarlos
 * salen del stock de la sucursal (de la entrada más vieja); quitarlos los
 * devuelve. Cuentan solo como costo: el presupuesto se sigue cargando a mano.
 * Qué costó cada uno y de qué entrada salió lo ve un admin.
 */
export function RepuestosCard({ orden, puedeEditar, esAdmin, onActualizada, onError }: RepuestosCardProps) {
  const inventario = orden.inventario ?? { servicios: [], repuestos: [] };
  const [texto, setTexto] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const buscado = useDebounce(texto);
  const [cambiando, setCambiando] = useState<RepuestoEnOrden | null>(null);
  const { enCurso, ejecutar } = useAccion(onError);

  const { datos: resultados } = useConsulta(
    () =>
      buscado.trim().length < 2
        ? Promise.resolve(null)
        : inventarioApi.listarArticulos({ search: buscado.trim() }),
    [buscado],
    'No se pudo buscar en el inventario'
  );
  const sugerencias = resultados?.articulos ?? [];

  async function agregar(articulo: ArticuloResumen) {
    const ok = await ejecutar(
      () =>
        ordenesApi.agregarRepuesto(
          orden.id,
          articulo.tipo === 'servicio'
            ? { servicioId: articulo.id }
            : { articuloId: articulo.id, cantidad: Math.max(1, Number(cantidad) || 1) }
        ),
      'No se pudo agregar'
    );
    if (ok) {
      setTexto('');
      setCantidad('1');
      onActualizada(`${articulo.nombre} agregado: ya se descontó del stock.`);
    }
  }

  /** Lo leído con la cámara: si es el código de un artículo, se agrega directo. */
  async function escaneado(codigo: string) {
    const encontrado: { articulo?: ArticuloResumen } = {};
    const ok = await ejecutar(async () => {
      encontrado.articulo = await inventarioApi.buscarPorCodigo(codigo);
    }, 'No hay ningún artículo con ese código');
    if (ok && encontrado.articulo) await agregar(encontrado.articulo);
    else setTexto(codigo);
  }

  async function quitarRepuesto(r: RepuestoEnOrden) {
    const ok = await ejecutar(() => ordenesApi.quitarRepuesto(orden.id, r.id), 'No se pudo quitar');
    if (ok) onActualizada(`${r.articulo.nombre} volvió al stock.`);
  }

  async function quitarServicio(id: number, nombre: string) {
    const ok = await ejecutar(() => ordenesApi.quitarServicio(orden.id, id), 'No se pudo quitar');
    if (ok) onActualizada(`Se sacó ${nombre}: sus repuestos volvieron al stock.`);
  }

  async function perdido(r: RepuestoEnOrden) {
    const motivo = window.prompt(
      `${r.articulo.nombre} se rompió al colocarlo: no vuelve al stock y queda como costo de la orden. ¿Qué pasó? (opcional)`
    );
    if (motivo === null) return;
    const ok = await ejecutar(
      () => ordenesApi.repuestoPerdido(orden.id, r.id, motivo.trim() || null),
      'No se pudo marcar'
    );
    if (ok) onActualizada(`${r.articulo.nombre} quedó como perdido.`);
  }

  const vacio = inventario.servicios.length === 0 && inventario.repuestos.length === 0;

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between flex-wrap gap-2">
        <span>Repuestos y servicios</span>
        <span className="small text-muted fw-normal">Cuentan como costo. No cambian el presupuesto.</span>
      </Card.Header>
      <Card.Body>
        {puedeEditar && (
          <div className="mb-3">
            <Row className="g-2">
              <Col>
                <CampoEscaneable
                  id="orden-agregar-repuesto"
                  value={texto}
                  onChange={setTexto}
                  onEscaneado={escaneado}
                  tituloEscaner="Escanear el repuesto"
                  placeholder="Buscar servicio, repuesto o código"
                />
              </Col>
              <Col xs={3} sm={2}>
                <Form.Control
                  type="number"
                  min={1}
                  aria-label="Cantidad del repuesto"
                  title="Cantidad (para un repuesto suelto)"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </Col>
            </Row>
            {sugerencias.length > 0 && (
              <ListGroup className="mt-1 overflow-auto" style={{ maxHeight: 220 }}>
                {sugerencias.map((a) => (
                  <ListGroup.Item
                    key={a.id}
                    action
                    type="button"
                    disabled={enCurso || (a.tipo !== 'servicio' && (a.cantidad ?? 0) === 0)}
                    onClick={() => agregar(a)}
                  >
                    <span className={`badge ${BADGE_TIPO[a.tipo]} me-2`}>{ETIQUETA_TIPO[a.tipo]}</span>
                    {a.nombre}
                    <span className="small text-muted">
                      {' · '}
                      {a.tipo === 'servicio'
                        ? `${(a.repuestos ?? []).length} repuestos`
                        : (a.cantidad ?? 0) === 0
                          ? 'no queda'
                          : `hay ${a.cantidad}`}
                    </span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>
        )}

        {vacio && <p className="text-muted mb-0">Todavía no se le puso nada del inventario.</p>}

        {inventario.servicios.map((s) => (
          <div key={s.id} className="border-top py-2">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div>
                <span className="badge badge-amber me-2">Servicio</span>
                <strong>{s.nombre}</strong>
                <div className="small text-muted">agregado el {formatearFecha(s.createdAt)}</div>
              </div>
              {puedeEditar && (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={enCurso}
                  onClick={() => quitarServicio(s.id, s.nombre)}
                >
                  Quitar
                </Button>
              )}
            </div>
            {s.repuestos.map((r) => (
              <FilaRepuesto
                key={r.id}
                repuesto={r}
                anidado
                puedeEditar={puedeEditar}
                esAdmin={esAdmin}
                enCurso={enCurso}
                onQuitar={() => quitarRepuesto(r)}
                onPerdido={() => perdido(r)}
                onCambiarEntrada={() => setCambiando(r)}
              />
            ))}
          </div>
        ))}
        {inventario.repuestos.map((r) => (
          <div key={r.id} className="border-top">
            <FilaRepuesto
              repuesto={r}
              puedeEditar={puedeEditar}
              esAdmin={esAdmin}
              enCurso={enCurso}
              onQuitar={() => quitarRepuesto(r)}
              onPerdido={() => perdido(r)}
              onCambiarEntrada={() => setCambiando(r)}
            />
          </div>
        ))}
      </Card.Body>

      <CambiarEntradaModal
        ordenId={orden.id}
        repuesto={cambiando}
        onCerrar={() => setCambiando(null)}
        onCambiado={() => {
          setCambiando(null);
          onActualizada('Se cambió la entrada del repuesto.');
        }}
        onError={onError}
      />
    </Card>
  );
}

function FilaRepuesto({
  repuesto: r,
  anidado = false,
  puedeEditar,
  esAdmin,
  enCurso,
  onQuitar,
  onPerdido,
  onCambiarEntrada
}: {
  repuesto: RepuestoEnOrden;
  anidado?: boolean;
  puedeEditar: boolean;
  esAdmin: boolean;
  enCurso: boolean;
  onQuitar: () => void;
  onPerdido: () => void;
  onCambiarEntrada: () => void;
}) {
  const enUso = r.estado === 'usado';
  return (
    <div
      className={`d-flex justify-content-between align-items-start flex-wrap gap-2 py-2 ${anidado ? 'ps-4' : ''}`}
    >
      <div>
        {!anidado && <span className="badge badge-blue me-2">Repuesto</span>}
        <Link to={`/inventario/articulos/${r.articulo.id}`}>{r.articulo.nombre}</Link>
        {r.estado === 'perdido' && <span className="badge badge-red ms-2">Se perdió</span>}
        <div className="small text-muted">
          {r.cantidad} {r.cantidad === 1 ? 'unidad' : 'unidades'}
          {r.entrada && ` · entrada ${r.entrada.etiqueta} del ${formatearFecha(r.entrada.fecha)}`}
          {esAdmin &&
            r.entrada?.costo != null &&
            ` · ${textoCostoUnitario({ ...r.entrada, costoUsd: null })} c/u`}
          {r.motivo && ` · ${r.motivo}`}
        </div>
      </div>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        {r.costoUsd != null && <span className="fw-semibold">{formatearMonto(r.costoUsd, 'USD')}</span>}
        {puedeEditar && enUso && (
          <>
            {esAdmin && (
              <Button size="sm" variant="outline-secondary" disabled={enCurso} onClick={onCambiarEntrada}>
                Cambiar entrada
              </Button>
            )}
            <Button size="sm" variant="outline-secondary" disabled={enCurso} onClick={onPerdido}>
              Se rompió
            </Button>
            <Button size="sm" variant="outline-secondary" disabled={enCurso} onClick={onQuitar}>
              Quitar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Elegir de qué entrada salen las unidades (por ejemplo, la de US$ 120 en vez de la más vieja). */
function CambiarEntradaModal({
  ordenId,
  repuesto,
  onCerrar,
  onCambiado,
  onError
}: {
  ordenId: number;
  repuesto: RepuestoEnOrden | null;
  onCerrar: () => void;
  onCambiado: () => void;
  onError: (mensaje: string) => void;
}) {
  const [elegida, setElegida] = useState<number | null>(null);
  const { enCurso, ejecutar } = useAccion(onError);
  const { datos: articulo, cargando } = useConsulta(
    () => (repuesto ? inventarioApi.obtenerArticulo(repuesto.articulo.id) : Promise.resolve(null)),
    [repuesto?.id],
    'No se pudieron cargar las entradas'
  );

  async function confirmar() {
    if (!repuesto || !elegida) return;
    const ok = await ejecutar(
      () => ordenesApi.cambiarEntradaRepuesto(ordenId, repuesto.id, elegida),
      'No se pudo cambiar la entrada'
    );
    if (ok) {
      setElegida(null);
      onCambiado();
    }
  }

  return (
    <Modal show={repuesto !== null} onHide={onCerrar} centered>
      <Modal.Header closeButton>
        <Modal.Title>¿De qué entrada sale?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small text-muted">
          {repuesto?.articulo.nombre}: las unidades actuales vuelven a su entrada y se toman de la que elijas.
        </p>
        {cargando && !articulo ? (
          <Spinner animation="border" size="sm" />
        ) : (
          (articulo?.entradas ?? []).map((e, i) => (
            <Form.Check
              key={e.id}
              type="radio"
              id={`entrada-${e.id}`}
              name="entrada"
              className="mb-2"
              checked={(elegida ?? repuesto?.entrada?.id) === e.id}
              onChange={() => setElegida(e.id)}
              label={
                <>
                  <span className="font-mono">{e.etiqueta}</span> · {formatearFecha(e.fecha)} ·{' '}
                  {textoCostoUnitario(e)} · quedan {e.disponible}
                  {i === 0 && <span className="small text-muted"> (la más vieja)</span>}
                </>
              }
            />
          ))
        )}
        {articulo && articulo.entradas.length === 0 && (
          <p className="text-muted mb-0">No quedan otras entradas en esta sucursal.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCerrar}>
          Volver
        </Button>
        <Button onClick={confirmar} disabled={enCurso || !elegida || elegida === repuesto?.entrada?.id}>
          {enCurso ? <Spinner size="sm" animation="border" /> : 'Usar esta entrada'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
