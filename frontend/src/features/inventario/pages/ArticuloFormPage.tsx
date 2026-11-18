import { FormEvent, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Form, InputGroup, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { X } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { BuscadorConSugerencias } from '@/shared/components/BuscadorConSugerencias';
import { CampoEscaneable } from '@/shared/components/CampoEscaneable';
import { Cargando } from '@/shared/components/Cargando';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { ArticuloResumen, Moneda, TipoArticulo } from '@/shared/types';
import { aNumero } from '@/shared/utils/dinero';
import { textoONull } from '@/shared/utils/texto';
import * as inventarioApi from '../api';
import { DatosCompra, type ValorCompra } from '../components/DatosCompra';
import { ETIQUETA_TIPO } from '../inventario';

interface PrecioForm {
  moneda: Moneda;
  monto: string;
}

interface RepuestoForm {
  repuesto: ArticuloResumen;
  cantidad: string;
}

const TIPOS: TipoArticulo[] = ['repuesto', 'accesorio', 'servicio'];

const AYUDA_TIPO: Record<TipoArticulo, string> = {
  repuesto: 'Se usa en las reparaciones y también se puede vender suelto.',
  accesorio: 'Fundas, cargadores, vidrios: se venden por mostrador.',
  servicio: 'Lo que se cobra (un cambio de módulo): puede llevar repuestos del inventario.'
};

/**
 * Alta y edición de un artículo del inventario. Un producto nuevo puede entrar
 * con su primera compra; un servicio, con los repuestos que lleva. Los nombres
 * de los precios son los del taller (Configuración).
 */
export function ArticuloFormPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const monedaLocal = usuario?.taller?.moneda ?? 'ARS';
  const idParam = useParams<{ id: string }>().id;
  const editando = idParam ? Number(idParam) : null;
  const [params] = useSearchParams();
  const tipoPedido = params.get('tipo') as TipoArticulo | null;

  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  const { datos: extra, recargar: recargarExtra } = useConsulta(
    () => inventarioApi.obtenerConfig(),
    [],
    'No se pudo cargar la configuración del inventario',
    'inventario-config'
  );
  const { datos: existente, cargando } = useConsulta(
    () => (editando ? inventarioApi.obtenerArticulo(editando) : Promise.resolve(null)),
    [editando],
    'No se pudo cargar el artículo'
  );

  const [tipo, setTipo] = useState<TipoArticulo>(
    tipoPedido && TIPOS.includes(tipoPedido) ? tipoPedido : 'repuesto'
  );
  const [categoriaId, setCategoriaId] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [precios, setPrecios] = useState<PrecioForm[]>(
    [0, 1, 2].map(() => ({ moneda: monedaLocal, monto: '' }))
  );
  const [repuestos, setRepuestos] = useState<RepuestoForm[]>([]);
  const [conEntrada, setConEntrada] = useState(false);
  const [cantidad, setCantidad] = useState('');
  const [costo, setCosto] = useState('');
  const [compra, setCompra] = useState<ValorCompra>({
    moneda: 'USD',
    cotizacion: '',
    proveedor: '',
    nota: ''
  });

  // Al editar, el formulario arranca con lo guardado.
  useEffect(() => {
    if (!existente) return;
    setTipo(existente.tipo);
    setCategoriaId(existente.categoria ? String(existente.categoria.id) : '');
    setNombre(existente.nombre);
    setCodigo(existente.codigo);
    setCodigoBarras(existente.codigoBarras ?? '');
    setStockMinimo(String(existente.stockMinimo));
    setPrecios(
      existente.preciosGuardados.map((p) => ({
        moneda: p?.moneda ?? monedaLocal,
        monto: p ? String(p.monto) : ''
      }))
    );
    setRepuestos(
      (existente.repuestos ?? []).map((r) => ({ repuesto: r.repuesto, cantidad: String(r.cantidad) }))
    );
  }, [existente, monedaLocal]);

  // Un producto nuevo arranca con el mínimo del taller (una sola vez: después manda el usuario).
  const minimoPropuesto = useRef(false);
  useEffect(() => {
    if (minimoPropuesto.current || editando || !extra) return;
    minimoPropuesto.current = true;
    setStockMinimo(String(extra.config.stockMinimoPorDefecto));
  }, [extra, editando]);

  const esServicio = tipo === 'servicio';
  const categorias = (extra?.categorias ?? []).filter((c) => c.grupo === tipo);
  const posiciones = extra?.config.precios ?? ['Lista', 'Efectivo', 'Tarjeta'];

  if (editando && cargando && !existente) return <Cargando />;

  async function crearCategoria() {
    const texto = nuevaCategoria?.trim();
    if (!texto) return;
    await ejecutar(async () => {
      const creada = await inventarioApi.crearCategoria(tipo, texto);
      setCategoriaId(String(creada.id));
      setNuevaCategoria(null);
      recargarExtra();
    }, 'No se pudo crear la categoría');
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const datos: inventarioApi.ArticuloInput = {
      categoriaId: categoriaId ? Number(categoriaId) : null,
      nombre: nombre.trim(),
      codigo: textoONull(codigo),
      codigoBarras: textoONull(codigoBarras),
      stockMinimo: esServicio ? undefined : Math.max(0, Math.round(aNumero(stockMinimo))),
      precios: precios.map((p, i) =>
        posiciones[i] && p.monto.trim() !== '' ? { monto: aNumero(p.monto), moneda: p.moneda } : null
      ),
      repuestos: esServicio
        ? repuestos.map((r) => ({
            repuestoId: r.repuesto.id,
            cantidad: Math.max(1, Math.round(aNumero(r.cantidad)))
          }))
        : undefined
    };
    if (!esServicio && conEntrada && !editando) {
      if (aNumero(cantidad) <= 0) return setError('Indicá cuántos entraron.');
      if (compra.moneda !== 'USD' && aNumero(compra.cotizacion) <= 0) {
        return setError('Indicá la cotización: el costo se informa en dólares.');
      }
    }

    await ejecutar(async () => {
      const guardado = editando
        ? await inventarioApi.actualizarArticulo(editando, datos)
        : await inventarioApi.crearArticulo({
            ...datos,
            tipo,
            entrada:
              !esServicio && conEntrada
                ? {
                    cantidad: Math.round(aNumero(cantidad)),
                    costo: aNumero(costo),
                    moneda: compra.moneda,
                    cotizacion: compra.moneda === 'USD' ? null : aNumero(compra.cotizacion),
                    proveedor: textoONull(compra.proveedor),
                    nota: textoONull(compra.nota)
                  }
                : null
          });
      navigate(`/inventario/articulos/${guardado.id}`);
    }, 'No se pudo guardar');
  }

  const titulo = editando
    ? `Editar ${ETIQUETA_TIPO[tipo].toLowerCase()}`
    : esServicio
      ? 'Nuevo servicio'
      : 'Cargar producto';

  return (
    <Form onSubmit={guardar} style={{ maxWidth: 900 }}>
      <div className="mb-3">
        <Link to={esServicio ? '/inventario?ver=servicios' : '/inventario'} className="small">
          ← Inventario
        </Link>
        <h3 className="mb-0 mt-1">{titulo}</h3>
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />

      <Card className="mb-3">
        <Card.Header>Qué es</Card.Header>
        <Card.Body>
          {!editando && (
            <Row className="g-2 mb-3" xs={1} md={3} role="radiogroup" aria-label="Tipo">
              {TIPOS.map((t) => (
                <Col key={t}>
                  <Form.Check
                    type="radio"
                    id={`tipo-${t}`}
                    name="tipo"
                    className={`border rounded p-3 ps-5 h-100 ${tipo === t ? 'border-primary' : ''}`}
                    checked={tipo === t}
                    onChange={() => {
                      setTipo(t);
                      setCategoriaId('');
                    }}
                    label={
                      <>
                        <strong>{ETIQUETA_TIPO[t]}</strong>
                        <div className="small text-muted">{AYUDA_TIPO[t]}</div>
                      </>
                    }
                  />
                </Col>
              ))}
            </Row>
          )}
          <Form.Group controlId="articulo-categoria" style={{ maxWidth: 420 }}>
            <Form.Label>
              Categoría <span className="text-muted fw-normal">(opcional)</span>
            </Form.Label>
            {nuevaCategoria === null ? (
              <InputGroup>
                <Form.Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Form.Select>
                <Button variant="outline-secondary" onClick={() => setNuevaCategoria('')}>
                  + Nueva
                </Button>
              </InputGroup>
            ) : (
              <InputGroup>
                <Form.Control
                  autoFocus
                  placeholder="Baterías, Módulos, Flexs…"
                  value={nuevaCategoria}
                  maxLength={100}
                  onChange={(e) => setNuevaCategoria(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      crearCategoria();
                    }
                  }}
                />
                <Button variant="outline-primary" onClick={crearCategoria} disabled={enCurso}>
                  Crear
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => setNuevaCategoria(null)}
                  aria-label="Cancelar"
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </InputGroup>
            )}
            <Form.Text>Las categorías son tuyas: también las ordenás en Configuración.</Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header>Datos</Card.Header>
        <Card.Body>
          <Form.Group controlId="articulo-nombre" className="mb-3">
            <Form.Label>Nombre</Form.Label>
            <Form.Control
              required
              maxLength={150}
              value={nombre}
              placeholder={esServicio ? 'Cambio de módulo iPhone 15 Pro' : 'Módulo iPhone 15 Pro OLED IC'}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Form.Group>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group controlId="articulo-codigo">
                <Form.Label>Código</Form.Label>
                <Form.Control
                  className="font-mono"
                  maxLength={30}
                  value={codigo}
                  placeholder={extra ? `${extra.config.prefijos[tipo]}…` : ''}
                  onChange={(e) => setCodigo(e.target.value)}
                />
                <Form.Text>{editando ? 'Lo podés cambiar.' : 'Vacío: se genera solo.'}</Form.Text>
              </Form.Group>
            </Col>
            <Col md={esServicio ? 8 : 4}>
              <Form.Group>
                <Form.Label htmlFor="articulo-barras">
                  Código de barras <span className="text-muted fw-normal">(opcional)</span>
                </Form.Label>
                <CampoEscaneable
                  id="articulo-barras"
                  value={codigoBarras}
                  onChange={setCodigoBarras}
                  tituloEscaner="Escanear código de barras"
                  maxLength={64}
                  placeholder="Escaneá o escribilo"
                />
              </Form.Group>
            </Col>
            {!esServicio && (
              <Col md={4}>
                <Form.Group controlId="articulo-minimo">
                  <Form.Label>Stock mínimo</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(e.target.value)}
                  />
                  <Form.Text>Avisa cuando una sucursal queda por debajo. 0 es sin aviso.</Form.Text>
                </Form.Group>
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between flex-wrap gap-2">
          <span>Precios</span>
          <Link to="/configuracion#inventario" className="small fw-normal">
            Cambiar los nombres de los precios
          </Link>
        </Card.Header>
        <Card.Body>
          {posiciones.map((nombrePrecio, i) =>
            nombrePrecio ? (
              <Row key={i} className="g-2 mb-2 align-items-center">
                <Col xs={12} sm={3}>
                  <Form.Label htmlFor={`precio-${i}`} className="mb-0 fw-semibold">
                    {nombrePrecio}
                  </Form.Label>
                </Col>
                <Col xs="auto">
                  <SelectorMoneda
                    value={precios[i].moneda}
                    onChange={(moneda) => setPrecios(precios.map((p, j) => (j === i ? { ...p, moneda } : p)))}
                  />
                </Col>
                <Col>
                  <Form.Control
                    id={`precio-${i}`}
                    inputMode="decimal"
                    placeholder="Sin precio"
                    value={precios[i].monto}
                    onChange={(e) =>
                      setPrecios(precios.map((p, j) => (j === i ? { ...p, monto: e.target.value } : p)))
                    }
                  />
                </Col>
              </Row>
            ) : null
          )}
          <Form.Text>
            Todos son opcionales. Son de referencia para vender y presupuestar: no cambian el presupuesto de
            una orden.
            {esServicio && ' El precio de un servicio ya incluye sus repuestos.'}
          </Form.Text>
        </Card.Body>
      </Card>

      {esServicio && <RepuestosDelServicio repuestos={repuestos} onChange={setRepuestos} />}

      {!esServicio && !editando && (
        <Card className="mb-3">
          <Card.Header>
            <Form.Check
              type="switch"
              id="con-entrada"
              label="Cargar la primera entrada"
              checked={conEntrada}
              onChange={(e) => setConEntrada(e.target.checked)}
            />
          </Card.Header>
          {conEntrada && (
            <Card.Body>
              <Row className="g-3 mb-3">
                <Col xs={6} md={3}>
                  <Form.Group controlId="entrada-cantidad">
                    <Form.Label>Cantidad</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      required
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col xs={6} md={3}>
                  <Form.Group controlId="entrada-costo">
                    <Form.Label>Costo por unidad</Form.Label>
                    <Form.Control
                      inputMode="decimal"
                      required
                      value={costo}
                      onChange={(e) => setCosto(e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <DatosCompra id="primera-entrada" valor={compra} onChange={setCompra} />
              <Form.Text>
                Entra en la sucursal en la que estás. Cada compra que sigue se carga como otra entrada.
              </Form.Text>
            </Card.Body>
          )}
        </Card>
      )}

      {editando && existente && !existente.activo && (
        <Alert variant="secondary">Este artículo está archivado: no aparece para usar ni vender.</Alert>
      )}

      <div className="d-flex justify-content-end gap-2 mb-4">
        <Button variant="outline-secondary" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enCurso}>
          {enCurso ? <Spinner size="sm" animation="border" /> : editando ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </div>
    </Form>
  );
}

/** Los repuestos que lleva un servicio, con cuántos de cada uno. Al usarlo en una orden se descuentan. */
function RepuestosDelServicio({
  repuestos,
  onChange
}: {
  repuestos: RepuestoForm[];
  onChange: (repuestos: RepuestoForm[]) => void;
}) {
  const [texto, setTexto] = useState('');
  const buscado = useDebounce(texto);
  const { datos } = useConsulta(
    () =>
      buscado.trim().length < 2
        ? Promise.resolve(null)
        : inventarioApi.listarArticulos({ tipo: 'productos', search: buscado.trim() }),
    [buscado],
    'No se pudieron buscar los repuestos'
  );
  const sugerencias = (datos?.articulos ?? []).filter((a) => !repuestos.some((r) => r.repuesto.id === a.id));

  return (
    <Card className="mb-3">
      <Card.Header>Repuestos que lleva</Card.Header>
      <Card.Body>
        {repuestos.map((r, i) => (
          <Row key={r.repuesto.id} className="g-2 mb-2 align-items-center">
            <Col>
              <span className="font-mono small text-muted me-2">{r.repuesto.codigo}</span>
              {r.repuesto.nombre}
            </Col>
            <Col xs={4} sm={2}>
              <Form.Control
                type="number"
                min={1}
                aria-label={`Cantidad de ${r.repuesto.nombre}`}
                value={r.cantidad}
                onChange={(e) =>
                  onChange(repuestos.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))
                }
              />
            </Col>
            <Col xs="auto">
              <Button
                variant="link"
                className="text-secondary"
                aria-label={`Quitar ${r.repuesto.nombre}`}
                onClick={() => onChange(repuestos.filter((_, j) => j !== i))}
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
          claveDe={(a) => a.id}
          mostrar={(a) => (
            <>
              <span className="font-mono small text-muted me-2">{a.codigo}</span>
              {a.nombre}
              <span className="small text-muted"> · hay {a.cantidad}</span>
            </>
          )}
          onElegir={(a) => {
            onChange([...repuestos, { repuesto: a, cantidad: '1' }]);
            setTexto('');
          }}
          placeholder="Buscar un repuesto o accesorio para agregar"
        />
        <Form.Text>
          Puede no llevar ninguno (una limpieza, un cambio de software). Al agregar el servicio a una orden se
          descuentan del stock, de la entrada más vieja.
        </Form.Text>
      </Card.Body>
    </Card>
  );
}
