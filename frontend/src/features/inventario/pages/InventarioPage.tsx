import { useState } from 'react';
import { Badge, ButtonGroup, Col, Form, Nav, Row, ToggleButton } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeftRight, CircleDollarSign, Package, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { CampoEscaneable } from '@/shared/components/CampoEscaneable';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { TarjetaDato } from '@/shared/components/TarjetaDato';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Articulo, TipoArticulo } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { filaClickeable } from '@/shared/utils/filas';
import * as inventarioApi from '../api';
import { BADGE_TIPO, ETIQUETA_TIPO, lineasDePrecios, textoCostos } from '../inventario';

type Grupo = 'productos' | 'repuesto' | 'accesorio';

const GRUPOS: { valor: Grupo; etiqueta: string }[] = [
  { valor: 'productos', etiqueta: 'Todos' },
  { valor: 'repuesto', etiqueta: 'Repuestos' },
  { valor: 'accesorio', etiqueta: 'Accesorios' }
];

/**
 * Inventario de la sucursal: los productos (repuestos y accesorios) con lo que
 * hay de cada uno, y los servicios. La cantidad suma todas las entradas; lo que
 * costó cada una se ve al entrar al producto. Los costos, solo un admin.
 */
export function InventarioPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const compartido = usuario?.taller?.stockEntreSucursales ?? false;
  const [params, setParams] = useSearchParams();
  const verServicios = params.get('ver') === 'servicios';

  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda);
  const [grupo, setGrupo] = useState<Grupo>('productos');
  const [categoriaId, setCategoriaId] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [bajoMinimo, setBajoMinimo] = useState(false);

  const tipo: TipoArticulo | 'productos' = verServicios ? 'servicio' : grupo;
  const { datos, cargando, error, setError } = useConsulta(
    () =>
      inventarioApi.listarArticulos({
        tipo,
        search: busquedaDebounced || undefined,
        categoriaId: categoriaId ? Number(categoriaId) : undefined,
        sucursal: sucursal === 'todas' ? 'todas' : sucursal ? Number(sucursal) : undefined,
        bajoMinimo: bajoMinimo || undefined
      }),
    [tipo, busquedaDebounced, categoriaId, sucursal, bajoMinimo],
    'No se pudo cargar el inventario',
    'inventario'
  );
  const { datos: extra } = useConsulta(
    () => inventarioApi.obtenerConfig(),
    [],
    'No se pudieron cargar las categorías',
    'inventario-config'
  );

  const articulos = datos?.articulos ?? [];
  const resumen = datos?.resumen;
  const categorias = (extra?.categorias ?? []).filter((c) =>
    verServicios ? c.grupo === 'servicio' : grupo === 'productos' ? c.grupo !== 'servicio' : c.grupo === grupo
  );
  const porRecibir = extra?.pasesPorRecibir ?? 0;

  function cambiarVista(servicios: boolean) {
    setCategoriaId('');
    setParams(servicios ? { ver: 'servicios' } : {}, { replace: true });
  }

  /** Lo que lee el escáner: si es un código exacto, abre el producto. */
  async function abrirEscaneado(codigo: string) {
    try {
      const articulo = await inventarioApi.buscarPorCodigo(codigo);
      navigate(`/inventario/articulos/${articulo.id}`);
    } catch {
      setBusqueda(codigo);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3 className="mb-0">Inventario</h3>
        <div className="d-flex gap-2 flex-wrap">
          <Link
            className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
            to="/inventario/pases"
          >
            <ArrowLeftRight size={18} aria-hidden="true" /> Pases
            {porRecibir > 0 && (
              <Badge bg="danger" pill>
                {porRecibir} por recibir
              </Badge>
            )}
          </Link>
          {!verServicios && (
            <Link className="btn btn-outline-primary" to="/inventario/entradas/nueva">
              + Nueva entrada
            </Link>
          )}
          <Link
            className="btn btn-primary"
            to={verServicios ? '/inventario/nuevo?tipo=servicio' : '/inventario/nuevo?tipo=repuesto'}
          >
            {verServicios ? '+ Nuevo servicio' : '+ Cargar producto'}
          </Link>
        </div>
      </div>

      <Nav variant="tabs" className="mb-3" activeKey={verServicios ? 'servicios' : 'productos'}>
        <Nav.Item>
          <Nav.Link eventKey="productos" onClick={() => cambiarVista(false)}>
            Productos
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="servicios" onClick={() => cambiarVista(true)}>
            Servicios
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {!verServicios && resumen && (
        <Row className="g-3 mb-3" xs={2} lg={4}>
          <Col>
            <TarjetaDato titulo="Productos" valor={resumen.productos} icono={Package} tono="blue" />
          </Col>
          <Col>
            <TarjetaDato titulo="Unidades" valor={resumen.unidades} icono={Package} tono="cyan" />
          </Col>
          {resumen.costoStockUsd != null && (
            <Col>
              <TarjetaDato
                titulo="Costo de lo que hay"
                valor={formatearMonto(resumen.costoStockUsd, 'USD')}
                detalle="Cada unidad a lo que costó"
                icono={CircleDollarSign}
                tono="green"
              />
            </Col>
          )}
          <Col>
            <TarjetaDato
              titulo="Bajo el mínimo"
              valor={resumen.bajoMinimo}
              icono={TriangleAlert}
              tono={resumen.bajoMinimo > 0 ? 'orange' : 'gris'}
              onClick={resumen.bajoMinimo > 0 ? () => setBajoMinimo(true) : undefined}
              accion={resumen.bajoMinimo > 0 ? 'Ver cuáles' : undefined}
            />
          </Col>
        </Row>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <div className="flex-grow-1" style={{ minWidth: 220, flexBasis: 280 }}>
          <CampoEscaneable
            id="inventario-buscar"
            value={busqueda}
            onChange={setBusqueda}
            onEscaneado={abrirEscaneado}
            tituloEscaner="Escanear código"
            placeholder="Nombre, código o código de barras"
          />
        </div>
        {!verServicios && (
          <ButtonGroup aria-label="Grupo" className="flex-wrap">
            {GRUPOS.map((g) => (
              <ToggleButton
                key={g.valor}
                id={`inventario-grupo-${g.valor}`}
                type="radio"
                name="inventario-grupo"
                variant="outline-primary"
                value={g.valor}
                checked={grupo === g.valor}
                onChange={() => {
                  setGrupo(g.valor);
                  setCategoriaId('');
                }}
              >
                {g.etiqueta}
              </ToggleButton>
            ))}
          </ButtonGroup>
        )}
        {categorias.length > 0 && (
          <Form.Select
            aria-label="Categoría"
            style={{ maxWidth: 220 }}
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Form.Select>
        )}
        {!verServicios && compartido && (
          <Form.Select
            aria-label="Sucursal"
            style={{ maxWidth: 220 }}
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
          >
            <option value="">Esta sucursal</option>
            <option value="todas">Todas las sucursales</option>
            {usuario?.sucursales
              .filter((s) => s.id !== usuario.sucursalActualId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
          </Form.Select>
        )}
        {!verServicios && (
          <Form.Check
            id="inventario-bajo-minimo"
            type="switch"
            label="Solo bajo el mínimo"
            checked={bajoMinimo}
            onChange={(e) => setBajoMinimo(e.target.checked)}
          />
        )}
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />

      {cargando && !datos ? (
        <Cargando />
      ) : verServicios ? (
        <TablaServicios articulos={articulos} onAbrir={(id) => navigate(`/inventario/articulos/${id}`)} />
      ) : (
        <TablaProductos
          articulos={articulos}
          filtrado={Boolean(busqueda || categoriaId || bajoMinimo || grupo !== 'productos')}
          onAbrir={(id) => navigate(`/inventario/articulos/${id}`)}
        />
      )}
      {!verServicios && articulos.length > 0 && (
        <p className="small text-muted mt-2 mb-0">
          La cantidad suma todas las entradas. Al entrar a un producto se ve cada entrada con lo que costó.
        </p>
      )}
    </div>
  );
}

function CeldaNombre({ articulo: a }: { articulo: Articulo }) {
  return (
    <>
      <div className="fw-semibold">
        {a.nombre}
        {!a.activo && (
          <Badge bg="secondary" className="ms-2">
            Archivado
          </Badge>
        )}
      </div>
      <div className="small">
        <span className={`badge ${BADGE_TIPO[a.tipo]}`}>{ETIQUETA_TIPO[a.tipo]}</span>
        {a.categoria && <span className="text-muted"> › {a.categoria.nombre}</span>}
      </div>
    </>
  );
}

function CeldaPrecios({ articulo }: { articulo: Articulo }) {
  const lineas = lineasDePrecios(articulo);
  if (lineas.length === 0) return <span className="text-muted small">Sin precio</span>;
  return (
    <>
      {lineas.map((l, i) => (
        <div key={l} className={i === 0 ? '' : 'small text-muted'}>
          {l}
        </div>
      ))}
    </>
  );
}

function TablaProductos({
  articulos,
  filtrado,
  onAbrir
}: {
  articulos: Articulo[];
  filtrado: boolean;
  onAbrir: (id: number) => void;
}) {
  const verCostos = articulos.some((a) => a.costos !== null);
  return (
    <TablaApilable hover responsive className="align-middle">
      <thead>
        <tr>
          <th>Código</th>
          <th>Producto</th>
          <th>Cantidad</th>
          {verCostos && <th>Costo de lo que queda</th>}
          <th>Precios</th>
        </tr>
      </thead>
      <tbody>
        {articulos.map((a) => (
          <tr key={a.id} {...filaClickeable(() => onAbrir(a.id))}>
            <td className="font-mono">{a.codigo}</td>
            <td>
              <CeldaNombre articulo={a} />
            </td>
            <td>
              <div className="fs-5 fw-bold">{a.cantidad}</div>
              {a.cantidad === 0 ? (
                <span className="badge badge-gris">Sin stock</span>
              ) : (
                a.bajoMinimo && <span className="badge badge-orange">Bajo el mínimo</span>
              )}
              {a.stockMinimo > 0 && <div className="small text-muted">Mínimo {a.stockMinimo}</div>}
            </td>
            {verCostos && (
              <td>
                {a.costoStockUsd ? (
                  <>
                    <div>{formatearMonto(a.costoStockUsd, 'USD')}</div>
                    <div className="small text-muted">{textoCostos(a.costos ?? [])}</div>
                  </>
                ) : (
                  <span className="small text-muted">
                    {a.ultimoCosto
                      ? `Última compra ${formatearMonto(a.ultimoCosto.costo, a.ultimoCosto.moneda)}`
                      : '—'}
                  </span>
                )}
              </td>
            )}
            <td>
              <CeldaPrecios articulo={a} />
            </td>
          </tr>
        ))}
        {articulos.length === 0 && (
          <tr>
            <td colSpan={verCostos ? 5 : 4} className="text-center text-muted">
              {filtrado ? 'Ningún producto coincide con la búsqueda' : 'Todavía no cargaste productos'}
            </td>
          </tr>
        )}
      </tbody>
    </TablaApilable>
  );
}

function TablaServicios({ articulos, onAbrir }: { articulos: Articulo[]; onAbrir: (id: number) => void }) {
  const verCostos = articulos.some((a) => a.costoHoyUsd !== null && a.costoHoyUsd !== undefined);
  return (
    <TablaApilable hover responsive className="align-middle">
      <thead>
        <tr>
          <th>Código</th>
          <th>Servicio</th>
          <th>Lleva</th>
          <th>Precios</th>
          {verCostos && <th>Costo hoy</th>}
        </tr>
      </thead>
      <tbody>
        {articulos.map((a) => {
          const lista = a.precios.find((p) => p.monto != null);
          return (
            <tr key={a.id} {...filaClickeable(() => onAbrir(a.id))}>
              <td className="font-mono">{a.codigo}</td>
              <td>
                <CeldaNombre articulo={a} />
              </td>
              <td>
                {(a.repuestos ?? []).length === 0 ? (
                  <span className="text-muted small">Sin repuestos</span>
                ) : (
                  (a.repuestos ?? []).map((r) => (
                    <div key={r.repuesto.id} className="small">
                      {r.cantidad} × {r.repuesto.nombre}
                    </div>
                  ))
                )}
              </td>
              <td>
                <CeldaPrecios articulo={a} />
              </td>
              {verCostos && (
                <td>
                  {a.costoHoyUsd != null ? formatearMonto(a.costoHoyUsd, 'USD') : '—'}
                  {a.costoHoyUsd != null && lista?.moneda === 'USD' && lista.monto != null && (
                    <div className="small text-muted">
                      Ganancia est. {formatearMonto(lista.monto - a.costoHoyUsd, 'USD')}
                    </div>
                  )}
                </td>
              )}
            </tr>
          );
        })}
        {articulos.length === 0 && (
          <tr>
            <td colSpan={verCostos ? 5 : 4} className="text-center text-muted">
              Todavía no cargaste servicios
            </td>
          </tr>
        )}
      </tbody>
    </TablaApilable>
  );
}
