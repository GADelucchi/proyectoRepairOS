import { useState } from 'react';
import { Badge, ButtonGroup, Card, Col, Form, Row, ToggleButton } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { Archive, CircleDollarSign, Clock, PackageCheck } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { TarjetaDato } from '@/shared/components/TarjetaDato';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { CondicionEquipo, EquipoStock, EstadoStock } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFecha } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import * as stockApi from '../api';
import {
  ETIQUETA_ESTADO_STOCK,
  VARIANTE_ESTADO_STOCK,
  describirEquipoStock,
  detalleCondicion,
  etiquetaNumero,
  textoAlmacenamiento
} from '../stock-form';

const FILTROS_ESTADO: { valor: EstadoStock | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'disponible', etiqueta: 'Disponibles' },
  { valor: 'reservado', etiqueta: 'Reservados' },
  { valor: 'senado', etiqueta: 'Señados' },
  { valor: 'vendido', etiqueta: 'Vendidos' }
];

/**
 * Stock de equipos para la venta, de la sucursal elegida (o de todas, si el
 * taller lo comparte). Cada renglón es una unidad con su propio costo.
 */
export function StockPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const compartido = usuario?.taller?.stockEntreSucursales ?? false;

  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda);
  const [estado, setEstado] = useState<EstadoStock | ''>('');
  const [condicion, setCondicion] = useState<CondicionEquipo | ''>('');
  const [sucursal, setSucursal] = useState<string>('');

  const { datos, cargando, error, setError } = useConsulta(
    () =>
      stockApi.listarStock({
        search: busquedaDebounced || undefined,
        estado: estado || undefined,
        condicion: condicion || undefined,
        sucursal: sucursal === 'todas' ? 'todas' : sucursal ? Number(sucursal) : undefined
      }),
    [busquedaDebounced, estado, condicion, sucursal],
    'No se pudo cargar el stock',
    'stock'
  );
  const equipos = datos?.equipos ?? [];
  const resumen = datos?.resumen;
  // Mirando otra sucursal (o todas), cada renglón dice dónde está el equipo.
  const muestraSucursal = sucursal !== '';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3 className="mb-0">Stock de equipos</h3>
        <Link className="btn btn-primary" to="/stock/nuevo">
          + Cargar equipo
        </Link>
      </div>

      {resumen && (
        <Row className="g-3 mb-3" xs={2} lg={4}>
          <Col>
            <TarjetaDato titulo="Disponibles" valor={resumen.disponibles} icono={PackageCheck} tono="green" />
          </Col>
          <Col>
            <TarjetaDato
              titulo="Apartados"
              valor={resumen.reservados + resumen.senados}
              detalle={`${resumen.reservados} reservados · ${resumen.senados} señados`}
              icono={Clock}
              tono="amber"
            />
          </Col>
          <Col>
            <TarjetaDato
              titulo="Costo del stock"
              valor={formatearMonto(resumen.costoStockUsd, 'USD')}
              detalle="Lo que queda sin vender, en US$"
              icono={CircleDollarSign}
              tono="blue"
            />
          </Col>
          <Col>
            <TarjetaDato titulo="Vendidos" valor={resumen.vendidos} icono={Archive} tono="gris" />
          </Col>
        </Row>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <Form.Control
          type="search"
          className="flex-grow-1"
          style={{ minWidth: 220, flexBasis: 260 }}
          placeholder="Número, serial, IMEI, marca o modelo"
          aria-label="Buscar en el stock"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <ButtonGroup aria-label="Estado" className="flex-wrap">
          {FILTROS_ESTADO.map((f) => (
            <ToggleButton
              key={f.valor || 'todos'}
              id={`stock-estado-${f.valor || 'todos'}`}
              type="radio"
              name="stock-estado"
              variant="outline-primary"
              value={f.valor}
              checked={estado === f.valor}
              onChange={() => setEstado(f.valor)}
            >
              {f.etiqueta}
            </ToggleButton>
          ))}
        </ButtonGroup>
        <Form.Select
          aria-label="Condición"
          style={{ maxWidth: 190 }}
          value={condicion}
          onChange={(e) => setCondicion(e.target.value as CondicionEquipo | '')}
        >
          <option value="">Nuevos y usados</option>
          <option value="nuevo">Nuevos</option>
          <option value="usado">Usados</option>
        </Form.Select>
        {compartido && (
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
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />

      {cargando && !datos ? (
        <Cargando />
      ) : (
        <TablaApilable hover responsive className="align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Equipo</th>
              <th>Compra</th>
              <th>Venta</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((e) => (
              <tr key={e.id} {...filaClickeable(() => navigate(`/stock/${e.id}`))}>
                <td className="font-mono">{etiquetaNumero(e.numero)}</td>
                <td>
                  <div className="fw-semibold">{describirEquipoStock(e)}</div>
                  <div className="small text-muted">
                    {detalleCondicion(e)}
                    {muestraSucursal && e.sucursal ? ` · ${e.sucursal.nombre}` : ''}
                  </div>
                </td>
                <td className="text-nowrap">
                  <CeldaCompra equipo={e} />
                </td>
                <td>
                  <CeldaVenta equipo={e} />
                </td>
              </tr>
            ))}
            {equipos.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted">
                  {busqueda || estado || condicion
                    ? 'Ningún equipo coincide con la búsqueda'
                    : 'Todavía no hay equipos en el stock'}
                </td>
              </tr>
            )}
          </tbody>
        </TablaApilable>
      )}

      {resumen && resumen.porModelo.length > 0 && (
        <Card className="mt-3">
          <Card.Header>En stock por modelo</Card.Header>
          <Card.Body className="py-2">
            {resumen.porModelo.map((m) => (
              <div
                key={`${m.marca}|${m.modelo}|${m.almacenamientoGb ?? ''}`}
                className="d-flex justify-content-between flex-wrap gap-2 py-2 border-bottom"
              >
                <strong>
                  {[`${m.marca} ${m.modelo}`, textoAlmacenamiento(m.almacenamientoGb)]
                    .filter(Boolean)
                    .join(' · ')}
                </strong>
                <span>
                  {m.cantidad} {m.cantidad === 1 ? 'unidad' : 'unidades'}:{' '}
                  {m.costos.map((c) => `${c.cantidad} × ${formatearMonto(c.costo, c.moneda)}`).join(' · ')}
                </span>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

function CeldaCompra({ equipo: e }: { equipo: EquipoStock }) {
  return (
    <>
      <div>{formatearMonto(e.costo, e.monedaCosto)}</div>
      <div className="small text-muted">
        {formatearFecha(e.fechaCompra)}
        {e.monedaCosto !== 'USD' && ` · ${formatearMonto(e.costoUsd, 'USD')}`}
      </div>
    </>
  );
}

/** Mientras no se vende, el precio de lista. La fecha y el valor de venta llegan con las ventas. */
function CeldaVenta({ equipo: e }: { equipo: EquipoStock }) {
  return (
    <>
      <Badge bg={VARIANTE_ESTADO_STOCK[e.estado]}>{ETIQUETA_ESTADO_STOCK[e.estado]}</Badge>
      <div className="small mt-1">
        {e.precio != null && e.monedaPrecio
          ? `Lista ${formatearMonto(e.precio, e.monedaPrecio)}`
          : 'Sin precio de lista'}
      </div>
    </>
  );
}
