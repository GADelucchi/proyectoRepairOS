import { FormEvent, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import * as stockApi from '@/features/stock/api';
import { describirEquipoStock, etiquetaNumero } from '@/features/stock/stock-form';
import { AlertaError } from '@/shared/components/AlertaError';
import { BuscadorConSugerencias } from '@/shared/components/BuscadorConSugerencias';
import { Cargando } from '@/shared/components/Cargando';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { EquipoStock, EstadoPase, Pase } from '@/shared/types';
import { formatearFecha } from '@/shared/utils/fechas';
import { nombreCompleto, textoONull } from '@/shared/utils/texto';
import * as inventarioApi from '../api';

type ItemForm =
  | {
      clave: string;
      tipo: 'articulo';
      id: number;
      codigo: string;
      nombre: string;
      hay: number;
      cantidad: string;
    }
  | { clave: string; tipo: 'equipo'; id: number; etiqueta: string; nombre: string };

const ESTADO: Record<EstadoPase, { texto: string; clase: string }> = {
  en_camino: { texto: 'En camino', clase: 'badge-amber' },
  recibido: { texto: 'Recibido', clase: 'badge-green' },
  cancelado: { texto: 'Cancelado', clase: 'badge-gris' }
};

/**
 * Pases entre sucursales: repuestos, accesorios y equipos del stock. Lo que se
 * manda sale de esta sucursal al toque y queda "en camino" hasta que la otra
 * confirma que lo recibió; recién ahí entra a su stock, con el mismo costo.
 */
export function PasesPage() {
  const { usuario } = useAuth();
  const sucursalActual = usuario?.sucursalActualId;
  const [params] = useSearchParams();
  const articuloInicial = Number(params.get('articulo')) || null;
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  const { datos, cargando, recargar } = useConsulta(
    () => inventarioApi.listarPases(),
    [],
    'No se pudieron cargar los pases',
    'pases'
  );

  async function recibir(pase: Pase) {
    const ok = await ejecutar(() => inventarioApi.recibirPase(pase.id), 'No se pudo confirmar la recepción');
    if (ok) {
      setMensaje(`${pase.etiqueta} recibido: ya está en el stock de esta sucursal.`);
      recargar();
    }
  }

  async function cancelar(pase: Pase) {
    if (!window.confirm(`¿Cancelar ${pase.etiqueta}? Todo vuelve a ${pase.sucursalOrigen.nombre}.`)) return;
    const ok = await ejecutar(() => inventarioApi.cancelarPase(pase.id), 'No se pudo cancelar el pase');
    if (ok) {
      setMensaje(`${pase.etiqueta} cancelado: todo volvió a ${pase.sucursalOrigen.nombre}.`);
      recargar();
    }
  }

  return (
    <div>
      <div className="mb-3">
        <Link to="/inventario" className="small">
          ← Inventario
        </Link>
        <h3 className="mb-0 mt-1">Pases entre sucursales</h3>
        <p className="text-muted mb-0">
          Para repuestos, accesorios y equipos del stock. Cada unidad conserva el costo con el que entró.
        </p>
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />
      {mensaje && (
        <Alert variant="success" dismissible onClose={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}

      {datos && datos.sucursales.length === 0 ? (
        <Alert variant="info">
          Para pasar mercadería hace falta otra sucursal. Las creás en{' '}
          <Link to="/admin/sucursales">Sucursales</Link>.
        </Alert>
      ) : (
        datos && (
          <NuevoPase
            sucursales={datos.sucursales}
            articuloInicial={articuloInicial}
            onCreado={(pase) => {
              setMensaje(
                `${pase.etiqueta} en camino a ${pase.sucursalDestino.nombre}. Entra a su stock cuando confirmen que llegó.`
              );
              recargar();
            }}
          />
        )
      )}

      <Card>
        <Card.Header>Pases de esta sucursal</Card.Header>
        {cargando && !datos ? (
          <Card.Body>
            <Cargando />
          </Card.Body>
        ) : (
          <div className="list-group list-group-flush">
            {(datos?.pases ?? []).map((p) => {
              const llegaAca = p.sucursalDestino.id === sucursalActual;
              return (
                <div key={p.id} className="list-group-item">
                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <div>
                      <span className="font-mono fw-semibold me-2">{p.etiqueta}</span>
                      <span className={`badge ${ESTADO[p.estado].clase}`}>{ESTADO[p.estado].texto}</span>
                      <div className="small d-flex align-items-center gap-1 mt-1">
                        {p.sucursalOrigen.nombre} <ArrowRight size={14} aria-label="a" />{' '}
                        {p.sucursalDestino.nombre}
                      </div>
                      <div className="small text-muted">
                        {formatearFecha(p.createdAt)} · mandó {nombreCompleto(p.enviadoPor) || '—'}
                        {p.recibidoEn &&
                          ` · recibió ${nombreCompleto(p.recibidoPor)} el ${formatearFecha(p.recibidoEn)}`}
                        {p.canceladoEn &&
                          ` · canceló ${nombreCompleto(p.canceladoPor)} el ${formatearFecha(p.canceladoEn)}`}
                      </div>
                      {p.nota && <div className="small">{p.nota}</div>}
                    </div>
                    {p.estado === 'en_camino' && (
                      <div className="d-flex gap-2 align-items-start">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => cancelar(p)}
                          disabled={enCurso}
                        >
                          Cancelar
                        </Button>
                        {llegaAca && (
                          <Button size="sm" onClick={() => recibir(p)} disabled={enCurso}>
                            Lo recibí
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <ul className="small mb-0 mt-2 ps-3">
                    {p.items.map((i) => (
                      <li key={i.id}>
                        {i.equipo ? (
                          <>
                            Equipo {i.equipo.etiqueta} · {i.equipo.marca} {i.equipo.modelo}
                          </>
                        ) : (
                          <>
                            {i.cantidad} × {i.articulo?.nombre}
                            {i.entrada && <span className="text-muted"> (de {i.entrada.etiqueta})</span>}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {(datos?.pases ?? []).length === 0 && (
              <div className="list-group-item text-center text-muted">Todavía no hay pases</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

/** El formulario de un pase nuevo desde esta sucursal. */
function NuevoPase({
  sucursales,
  articuloInicial,
  onCreado
}: {
  sucursales: { id: number; nombre: string }[];
  articuloInicial: number | null;
  onCreado: (pase: Pase) => void;
}) {
  const [destino, setDestino] = useState(sucursales.length === 1 ? String(sucursales[0].id) : '');
  const [nota, setNota] = useState('');
  const [items, setItems] = useState<ItemForm[]>([]);
  const [texto, setTexto] = useState('');
  const buscado = useDebounce(texto);
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  const { datos: inicial } = useConsulta(
    () => (articuloInicial ? inventarioApi.obtenerArticulo(articuloInicial) : Promise.resolve(null)),
    [articuloInicial],
    'No se pudo cargar el producto'
  );
  // El producto desde el que se vino entra como primer renglón, una sola vez.
  const inicialAgregado = useRef(false);
  useEffect(() => {
    if (inicialAgregado.current || !inicial || inicial.tipo === 'servicio') return;
    inicialAgregado.current = true;
    setItems((actuales) =>
      actuales.length
        ? actuales
        : [
            {
              clave: `a${inicial.id}`,
              tipo: 'articulo',
              id: inicial.id,
              codigo: inicial.codigo,
              nombre: inicial.nombre,
              hay: inicial.cantidad ?? 0,
              cantidad: '1'
            }
          ]
    );
  }, [inicial]);

  // Busca a la vez productos del inventario y equipos disponibles del stock.
  const { datos: resultados } = useConsulta(
    async () => {
      const termino = buscado.trim();
      if (termino.length < 2) return [];
      const [productos, stock] = await Promise.all([
        inventarioApi.listarArticulos({ tipo: 'productos', search: termino }),
        stockApi.listarStock({ search: termino, estado: 'disponible' })
      ]);
      const deProductos: ItemForm[] = productos.articulos
        .filter((a) => (a.cantidad ?? 0) > 0)
        .map((a) => ({
          clave: `a${a.id}`,
          tipo: 'articulo',
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          hay: a.cantidad ?? 0,
          cantidad: '1'
        }));
      const deStock: ItemForm[] = stock.equipos.map((e: EquipoStock) => ({
        clave: `e${e.id}`,
        tipo: 'equipo',
        id: e.id,
        etiqueta: etiquetaNumero(e.numero),
        nombre: describirEquipoStock(e)
      }));
      return [...deProductos, ...deStock];
    },
    [buscado],
    'No se pudo buscar'
  );
  const sugerencias = (resultados ?? []).filter((r) => !items.some((i) => i.clave === r.clave));

  async function mandar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!destino) return setError('Elegí a qué sucursal se manda.');
    if (items.length === 0) return setError('Agregá lo que se manda.');
    let creado: Pase | null = null;
    const ok = await ejecutar(async () => {
      creado = await inventarioApi.crearPase({
        sucursalDestinoId: Number(destino),
        nota: textoONull(nota),
        items: items.map((i) =>
          i.tipo === 'equipo'
            ? { equipoStockId: i.id }
            : { articuloId: i.id, cantidad: Math.max(1, Number(i.cantidad) || 1) }
        )
      });
    }, 'No se pudo hacer el pase');
    if (ok && creado) {
      setItems([]);
      setNota('');
      onCreado(creado);
    }
  }

  return (
    <Card className="mb-3">
      <Card.Header>Nuevo pase desde esta sucursal</Card.Header>
      <Card.Body>
        <Form onSubmit={mandar}>
          <AlertaError error={error} onCerrar={() => setError(null)} />
          <Row className="g-3 mb-3">
            <Col md={4}>
              <Form.Group controlId="pase-destino">
                <Form.Label>Hacia</Form.Label>
                <Form.Select value={destino} onChange={(e) => setDestino(e.target.value)} required>
                  <option value="">Elegí la sucursal</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group controlId="pase-nota">
                <Form.Label>
                  Nota <span className="text-muted fw-normal">(opcional)</span>
                </Form.Label>
                <Form.Control
                  maxLength={255}
                  placeholder="Quién lo lleva, en qué caja…"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>

          {items.map((i) => (
            <Row key={i.clave} className="g-2 mb-2 align-items-center">
              <Col>
                <Badge bg={i.tipo === 'equipo' ? 'success' : 'info'} className="me-2">
                  {i.tipo === 'equipo' ? 'Equipo' : 'Producto'}
                </Badge>
                <span className="font-mono small text-muted me-2">
                  {i.tipo === 'equipo' ? i.etiqueta : i.codigo}
                </span>
                {i.nombre}
                {i.tipo === 'articulo' && <span className="small text-muted"> · hay {i.hay}</span>}
              </Col>
              {i.tipo === 'articulo' && (
                <Col xs={4} sm={2}>
                  <Form.Control
                    type="number"
                    min={1}
                    max={i.hay}
                    aria-label={`Cuántos ${i.nombre}`}
                    value={i.cantidad}
                    onChange={(e) =>
                      setItems(
                        items.map((x) => (x.clave === i.clave ? { ...x, cantidad: e.target.value } : x))
                      )
                    }
                  />
                </Col>
              )}
              <Col xs="auto">
                <Button
                  variant="link"
                  className="text-secondary p-1"
                  aria-label={`Quitar ${i.nombre}`}
                  onClick={() => setItems(items.filter((x) => x.clave !== i.clave))}
                >
                  <X size={18} aria-hidden="true" />
                </Button>
              </Col>
            </Row>
          ))}

          <BuscadorConSugerencias
            texto={texto}
            onTextoChange={setTexto}
            sugerencias={sugerencias}
            claveDe={(r) => r.clave}
            mostrar={(r) => (
              <>
                <Badge bg={r.tipo === 'equipo' ? 'success' : 'info'} className="me-2">
                  {r.tipo === 'equipo' ? 'Equipo' : 'Producto'}
                </Badge>
                {r.nombre}
                <span className="small text-muted">
                  {' '}
                  · {r.tipo === 'equipo' ? r.etiqueta : `hay ${r.hay}`}
                </span>
              </>
            )}
            onElegir={(r) => {
              setItems([...items, r]);
              setTexto('');
            }}
            placeholder="Buscar un producto o un equipo del stock"
          />

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
            <span className="small text-muted">
              Sale de esta sucursal ahora; entra en la otra cuando confirmen que llegó.
            </span>
            <Button type="submit" disabled={enCurso}>
              {enCurso ? <Spinner size="sm" animation="border" /> : 'Mandar'}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
