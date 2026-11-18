import { FormEvent, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
  ToggleButton
} from 'react-bootstrap';
import { Link, useParams } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { ArticuloDetalle, EntradaInventario, Moneda } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import { formatearFecha } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as inventarioApi from '../api';
import {
  BADGE_TIPO,
  ETIQUETA_TIPO,
  cantidadConSigno,
  textoCostoUnitario,
  textoMovimiento
} from '../inventario';

/**
 * Un artículo del inventario. Para un producto: lo que hay en cada sucursal,
 * las entradas con lo que costó cada una (de la que se usa primero a la más
 * nueva) y los movimientos. Para un servicio: los repuestos que lleva.
 */
export function ArticuloPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { esAdmin } = useAuth();
  const [sucursal, setSucursal] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [bajaDe, setBajaDe] = useState<EntradaInventario | null>(null);
  const [verAgotadas, setVerAgotadas] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const { enCurso, ejecutar } = useAccion(setError);

  const {
    datos: articulo,
    cargando,
    error: errorCarga,
    setDatos,
    recargar
  } = useConsulta(
    () => inventarioApi.obtenerArticulo(id, sucursal),
    [id, sucursal],
    'No se pudo cargar el artículo'
  );

  if (cargando && !articulo) return <Cargando />;
  if (!articulo) return <Alert variant="danger">{errorCarga ?? 'Artículo no encontrado'}</Alert>;

  const esServicio = articulo.tipo === 'servicio';
  const sucursalMirada = articulo.porSucursal.find((s) => s.id === articulo.sucursalId);

  async function archivar(activo: boolean) {
    await ejecutar(async () => {
      setDatos(await inventarioApi.archivarArticulo(id, activo));
      setMensaje(activo ? 'Volvió a estar activo.' : 'Archivado: ya no aparece para usar ni vender.');
    }, 'No se pudo cambiar');
  }

  return (
    <div>
      <div className="mb-3">
        <Link to={esServicio ? '/inventario?ver=servicios' : '/inventario'} className="small">
          ← Inventario
        </Link>
      </div>
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h3 className="mb-1">
            {articulo.nombre}
            {!articulo.activo && (
              <Badge bg="secondary" className="ms-2 align-middle fs-6">
                Archivado
              </Badge>
            )}
          </h3>
          <div className="text-muted small">
            <span className="font-mono">{articulo.codigo}</span>
            {articulo.codigoBarras && (
              <>
                {' · '}Código de barras <span className="font-mono">{articulo.codigoBarras}</span>
              </>
            )}
            {' · '}
            <span className={`badge ${BADGE_TIPO[articulo.tipo]}`}>{ETIQUETA_TIPO[articulo.tipo]}</span>
            {articulo.categoria && ` › ${articulo.categoria.nombre}`}
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {esAdmin && (
            <Button variant="outline-secondary" onClick={() => archivar(!articulo.activo)} disabled={enCurso}>
              {articulo.activo ? 'Archivar' : 'Reactivar'}
            </Button>
          )}
          <Link className="btn btn-outline-primary" to={`/inventario/articulos/${id}/editar`}>
            Editar
          </Link>
          {!esServicio && esAdmin && (
            <Button variant="outline-primary" onClick={() => setAjustando(true)}>
              Ajustar por conteo
            </Button>
          )}
          {!esServicio && (
            <>
              <Link className="btn btn-outline-primary" to={`/inventario/pases?articulo=${id}`}>
                Pasar a otra sucursal
              </Link>
              <Link className="btn btn-primary" to={`/inventario/entradas/nueva?articulo=${id}`}>
                + Nueva entrada
              </Link>
            </>
          )}
        </div>
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />
      {mensaje && (
        <Alert variant="success" dismissible onClose={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}

      {!esServicio && (
        <Row className="g-3 mb-3" xs={2} md={4}>
          {articulo.porSucursal.map((s) => (
            <Col key={s.id}>
              <Card body className="h-100">
                <div className="small text-muted">En {s.nombre}</div>
                <div className="fs-4 fw-bold">{s.cantidad}</div>
              </Card>
            </Col>
          ))}
          <Col>
            <Card body className="h-100">
              <div className="small text-muted">Stock mínimo (por sucursal)</div>
              <div className="fs-4 fw-bold">{articulo.stockMinimo || '—'}</div>
            </Card>
          </Col>
          {articulo.costoStockUsd != null && (
            <Col>
              <Card body className="h-100">
                <div className="small text-muted">
                  Costo de lo que queda{sucursalMirada ? ` en ${sucursalMirada.nombre}` : ''}
                </div>
                <div className="fs-4 fw-bold">{formatearMonto(articulo.costoStockUsd, 'USD')}</div>
              </Card>
            </Col>
          )}
        </Row>
      )}

      <Row className="g-3 mb-3">
        <Col lg={esServicio ? 7 : 8}>
          {esServicio ? (
            <RepuestosDeServicio articulo={articulo} />
          ) : (
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span>Entradas</span>
                {articulo.porSucursal.length > 1 && (
                  <ButtonGroup aria-label="Sucursal" size="sm">
                    {articulo.porSucursal.map((s) => (
                      <ToggleButton
                        key={s.id}
                        id={`entradas-sucursal-${s.id}`}
                        type="radio"
                        name="entradas-sucursal"
                        variant="outline-primary"
                        value={s.id}
                        checked={articulo.sucursalId === s.id}
                        onChange={() => setSucursal(s.id)}
                      >
                        {s.nombre}
                      </ToggleButton>
                    ))}
                  </ButtonGroup>
                )}
              </Card.Header>
              <TablaApilable responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Entrada</th>
                    <th>Compradas</th>
                    <th>Quedan</th>
                    {esAdmin && <th>Costo por unidad</th>}
                    {esAdmin && <th aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {[...articulo.entradas, ...(verAgotadas ? articulo.agotadas : [])].map((e, i) => (
                    <tr key={e.id}>
                      <td>
                        <span className="font-mono">{e.etiqueta}</span>
                        <div className="small text-muted">
                          {formatearFecha(e.fecha)}
                          {e.proveedor && ` · ${e.proveedor}`}
                          {e.origen === 'pase' && ' · llegó por un pase'}
                          {e.origen === 'ajuste' && ' · apareció en un conteo'}
                        </div>
                        {i === 0 && e.disponible > 0 && (
                          <span className="badge badge-green">Se usa primero</span>
                        )}
                        {e.disponible === 0 && <span className="badge badge-gris">Agotada</span>}
                      </td>
                      <td>{e.cantidad}</td>
                      <td className="fw-bold">{e.disponible}</td>
                      {esAdmin && (
                        <td>
                          {textoCostoUnitario(e)}
                          {e.cotizacion != null && (
                            <div className="small text-muted">Cotización {e.cotizacion}</div>
                          )}
                        </td>
                      )}
                      {esAdmin && (
                        <td className="text-end">
                          {e.disponible > 0 && (
                            <Button size="sm" variant="outline-secondary" onClick={() => setBajaDe(e)}>
                              Dar de baja
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {articulo.entradas.length === 0 && !verAgotadas && (
                    <tr>
                      <td colSpan={esAdmin ? 5 : 3} className="text-center text-muted">
                        No queda ninguno en esta sucursal
                      </td>
                    </tr>
                  )}
                </tbody>
              </TablaApilable>
              <Card.Footer className="small text-muted d-flex justify-content-between flex-wrap gap-2">
                <span>
                  Cada unidad conserva el costo de su entrada. Al usarla o venderla se toma la de la entrada
                  más vieja, salvo que elijas otra.
                </span>
                {articulo.agotadas.length > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0"
                    onClick={() => setVerAgotadas(!verAgotadas)}
                  >
                    {verAgotadas ? 'Ocultar agotadas' : `Ver ${articulo.agotadas.length} agotadas`}
                  </Button>
                )}
              </Card.Footer>
            </Card>
          )}
        </Col>
        <Col lg={esServicio ? 5 : 4}>
          <Card className="mb-3">
            <Card.Header>Precios</Card.Header>
            <Card.Body className="py-2">
              {articulo.precios.map((p) => (
                <div key={p.posicion} className="d-flex justify-content-between py-1 border-bottom">
                  <span className="text-muted">{p.nombre}</span>
                  <strong>{p.monto != null && p.moneda ? formatearMonto(p.monto, p.moneda) : '—'}</strong>
                </div>
              ))}
            </Card.Body>
          </Card>
          {articulo.usadoEnServicios.length > 0 && (
            <Card>
              <Card.Header>Lo usan estos servicios</Card.Header>
              <Card.Body className="py-2">
                {articulo.usadoEnServicios.map((s) => (
                  <div key={s.id} className="py-1">
                    <Link to={`/inventario/articulos/${s.id}`}>{s.nombre}</Link>
                    <div className="small text-muted">
                      {s.cantidad} {s.cantidad === 1 ? 'unidad' : 'unidades'} por servicio
                    </div>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {!esServicio && <Movimientos articulo={articulo} verCostos={esAdmin} />}

      {esAdmin && !esServicio && (
        <AjusteModal
          articulo={articulo}
          show={ajustando}
          onCerrar={() => setAjustando(false)}
          onAjustado={(resultado) => {
            setAjustando(false);
            setDatos(resultado.articulo);
            setMensaje(
              resultado.diferencia === 0
                ? 'El conteo coincide: no hubo que corregir nada.'
                : resultado.diferencia < 0
                  ? `Ajustado: salieron ${-resultado.diferencia} (había ${resultado.habia}, se contaron ${resultado.contada}).`
                  : `Ajustado: entraron ${resultado.diferencia} (había ${resultado.habia}, se contaron ${resultado.contada}).`
            );
          }}
        />
      )}

      <BajaModal
        entrada={bajaDe}
        onCerrar={() => setBajaDe(null)}
        onHecho={() => {
          setBajaDe(null);
          setMensaje('Unidades dadas de baja.');
          recargar();
        }}
      />
    </div>
  );
}

function RepuestosDeServicio({ articulo }: { articulo: ArticuloDetalle }) {
  const repuestos = articulo.repuestos ?? [];
  const lista = articulo.precios.find((p) => p.monto != null);
  return (
    <Card>
      <Card.Header>Repuestos que lleva</Card.Header>
      <Card.Body className="py-2">
        {repuestos.length === 0 && <p className="text-muted mb-0">No lleva repuestos del inventario.</p>}
        {repuestos.map((r) => (
          <div key={r.repuesto.id} className="d-flex justify-content-between gap-2 py-1 border-bottom">
            <span>
              {r.cantidad} × <Link to={`/inventario/articulos/${r.repuesto.id}`}>{r.repuesto.nombre}</Link>
            </span>
            {r.costoHoyUsd != null && <span>{formatearMonto(r.costoHoyUsd, 'USD')}</span>}
          </div>
        ))}
        {articulo.costoHoyUsd != null && repuestos.length > 0 && (
          <div className="d-flex justify-content-between pt-2 fw-semibold">
            <span>Costo de repuestos hoy</span>
            <span>{formatearMonto(articulo.costoHoyUsd, 'USD')}</span>
          </div>
        )}
        {articulo.costoHoyUsd != null && lista?.moneda === 'USD' && lista.monto != null && (
          <div className="d-flex justify-content-between text-success">
            <span>Ganancia estimada ({lista.nombre})</span>
            <span>{formatearMonto(lista.monto - articulo.costoHoyUsd, 'USD')}</span>
          </div>
        )}
      </Card.Body>
      <Card.Footer className="small text-muted">
        El precio ya incluye los repuestos. Al agregar el servicio a una orden se descuentan del stock de esa
        sucursal.
      </Card.Footer>
    </Card>
  );
}

function Movimientos({ articulo, verCostos }: { articulo: ArticuloDetalle; verCostos: boolean }) {
  return (
    <Card>
      <Card.Header>Movimientos en esta sucursal</Card.Header>
      <TablaApilable responsive className="mb-0 align-middle">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Movimiento</th>
            <th>Cantidad</th>
            <th>Entrada</th>
            <th>Quién</th>
          </tr>
        </thead>
        <tbody>
          {articulo.movimientos.map((m) => (
            <tr key={m.id}>
              <td className="text-nowrap">{formatearFecha(m.fecha)}</td>
              <td>
                {m.orden ? (
                  <Link to={`/ordenes/${m.orden.id}`}>{textoMovimiento(m)}</Link>
                ) : m.venta ? (
                  <Link to={`/ventas/${m.venta.id}`}>{textoMovimiento(m)}</Link>
                ) : m.equipoStock ? (
                  <Link to={`/stock/${m.equipoStock.id}`}>{textoMovimiento(m)}</Link>
                ) : (
                  textoMovimiento(m)
                )}
                {m.nota && <div className="small text-muted">{m.nota}</div>}
              </td>
              <td
                className={
                  m.cantidad > 0
                    ? 'text-success fw-semibold'
                    : m.cantidad < 0
                      ? 'text-danger fw-semibold'
                      : ''
                }
              >
                {cantidadConSigno(m.cantidad)}
              </td>
              <td>
                {m.entrada && <span className="font-mono">{m.entrada.etiqueta}</span>}
                {verCostos && m.entrada?.costoUsd != null && (
                  <div className="small text-muted">{formatearMonto(m.entrada.costoUsd, 'USD')} c/u</div>
                )}
              </td>
              <td>{nombreCompleto(m.usuario) || '—'}</td>
            </tr>
          ))}
          {articulo.movimientos.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted">
                Todavía no hay movimientos en esta sucursal
              </td>
            </tr>
          )}
        </tbody>
      </TablaApilable>
    </Card>
  );
}

/** Sacar unidades de una entrada sin usarlas: una carga equivocada, algo que se rompió en el cajón (admin). */
function BajaModal({
  entrada,
  onCerrar,
  onHecho
}: {
  entrada: EntradaInventario | null;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [cantidad, setCantidad] = useState('1');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!entrada) return;
    const ok = await ejecutar(
      () => inventarioApi.darDeBajaUnidades(entrada.id, Number(cantidad), motivo.trim()),
      'No se pudieron dar de baja'
    );
    if (ok) {
      setCantidad('1');
      setMotivo('');
      onHecho();
    }
  }

  return (
    <Modal show={entrada !== null} onHide={onCerrar} centered>
      <Form onSubmit={confirmar}>
        <Modal.Header closeButton>
          <Modal.Title>Dar de baja de {entrada?.etiqueta}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} onCerrar={() => setError(null)} />
          <Form.Group controlId="baja-cantidad" className="mb-3">
            <Form.Label>Cuántas (quedan {entrada?.disponible})</Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={entrada?.disponible}
              required
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="baja-motivo">
            <Form.Label>Por qué</Form.Label>
            <Form.Control
              required
              minLength={3}
              maxLength={255}
              placeholder="Se cargó de más, se rompió en el cajón…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Form.Group>
          <Form.Text>Salen del stock y quedan en el historial. No suman al costo de ninguna orden.</Form.Text>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCerrar}>
            Volver
          </Button>
          <Button type="submit" variant="danger" disabled={enCurso}>
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Dar de baja'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/**
 * Ajuste por conteo (solo admin): se carga cuántos hay de verdad en esta
 * sucursal. Si faltan, salen de las entradas más viejas; si sobran, entran con
 * el costo de la última compra (o el que se indique).
 */
function AjusteModal({
  articulo,
  show,
  onCerrar,
  onAjustado
}: {
  articulo: ArticuloDetalle;
  show: boolean;
  onCerrar: () => void;
  onAjustado: (resultado: inventarioApi.ResultadoAjuste) => void;
}) {
  const hay = articulo.cantidad ?? 0;
  const ultimo = articulo.ultimoCosto;
  const [contada, setContada] = useState('');
  const [motivo, setMotivo] = useState('');
  const [moneda, setMoneda] = useState<Moneda>(ultimo?.moneda ?? 'USD');
  const [costo, setCosto] = useState(ultimo ? String(ultimo.costo) : '');
  const [cotizacion, setCotizacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);
  const sucursal = articulo.porSucursal.find((s) => s.id === articulo.sucursalId)?.nombre ?? 'esta sucursal';

  const diferencia = contada.trim() === '' ? null : Math.round(Number(contada)) - hay;
  const sobran = diferencia !== null && diferencia > 0;

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (diferencia === null || Number(contada) < 0) return setError('Indicá cuántos contaste.');
    if (sobran && !(aNumero(costo) >= 0 && costo.trim()))
      return setError('Indicá el costo de cada unidad que apareció.');
    if (sobran && moneda !== 'USD' && !(aNumero(cotizacion) > 0))
      return setError('Indicá la cotización del dólar.');
    let resultado: inventarioApi.ResultadoAjuste | null = null;
    const ok = await ejecutar(async () => {
      resultado = await inventarioApi.ajustarPorConteo(articulo.id, {
        cantidadContada: Math.round(Number(contada)),
        motivo: motivo.trim(),
        costo: sobran
          ? { moneda, monto: aNumero(costo), cotizacion: moneda === 'USD' ? null : aNumero(cotizacion) }
          : null
      });
    }, 'No se pudo ajustar');
    if (ok && resultado) {
      setContada('');
      setMotivo('');
      onAjustado(resultado);
    }
  }

  return (
    <Modal show={show} onHide={onCerrar} centered>
      <Form onSubmit={confirmar}>
        <Modal.Header closeButton>
          <Modal.Title>Ajustar por conteo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} onCerrar={() => setError(null)} />
          <p>
            Según el sistema hay <strong>{hay}</strong> en {sucursal}.
          </p>
          <Form.Group controlId="ajuste-contada" className="mb-3">
            <Form.Label>¿Cuántos contaste?</Form.Label>
            <Form.Control
              type="number"
              min={0}
              required
              autoFocus
              value={contada}
              onChange={(e) => setContada(e.target.value)}
            />
            {diferencia !== null && diferencia !== 0 && (
              <Form.Text className={diferencia < 0 ? 'text-danger' : 'text-success'}>
                {diferencia < 0
                  ? `Faltan ${-diferencia}: salen de las entradas más viejas.`
                  : `Sobran ${diferencia}: entran como una entrada de ajuste.`}
              </Form.Text>
            )}
            {diferencia === 0 && <Form.Text>Coincide con el sistema.</Form.Text>}
          </Form.Group>
          {sobran && (
            <Form.Group className="mb-3">
              <Form.Label htmlFor="ajuste-costo">Costo de cada unidad que apareció</Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                <SelectorMoneda value={moneda} onChange={setMoneda} />
                <Form.Control
                  id="ajuste-costo"
                  inputMode="decimal"
                  style={{ maxWidth: 160 }}
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                />
                {moneda !== 'USD' && (
                  <Form.Control
                    inputMode="decimal"
                    aria-label="Cotización del dólar"
                    placeholder={`${moneda} por US$ 1`}
                    style={{ maxWidth: 160 }}
                    value={cotizacion}
                    onChange={(e) => setCotizacion(e.target.value)}
                  />
                )}
              </div>
              <Form.Text>
                {ultimo ? 'Arranca con el de la última compra.' : 'El producto todavía no tuvo compras.'}
              </Form.Text>
            </Form.Group>
          )}
          <Form.Group controlId="ajuste-motivo">
            <Form.Label>Por qué</Form.Label>
            <Form.Control
              required
              minLength={3}
              maxLength={255}
              placeholder="Conteo de fin de mes, estaban en otro cajón…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCerrar}>
            Volver
          </Button>
          <Button type="submit" disabled={enCurso || diferencia === null}>
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Ajustar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
