import { useState } from 'react';
import { Alert, Badge, ButtonGroup, Form, ToggleButton } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { describirEquipoStock } from '@/features/stock/stock-form';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { EstadoVenta, VentaEnLista } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import { formatearFecha } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as ventasApi from '../api';
import { DIAS_AVISO_SENA, ETIQUETA_ESTADO_VENTA, VARIANTE_ESTADO_VENTA, diasDesde } from '../venta-form';

const FILTROS: { valor: EstadoVenta | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'reservada', etiqueta: 'Reservadas' },
  { valor: 'senada', etiqueta: 'Señadas' },
  { valor: 'completada', etiqueta: 'Completadas' },
  { valor: 'cancelada', etiqueta: 'Canceladas' },
  { valor: 'vencida', etiqueta: 'Vencidas' }
];

/** Ventas de equipos de la sucursal (o de todas, para un admin). Las señas viejas se marcan arriba. */
export function VentasPage() {
  const navigate = useNavigate();
  const { esAdmin } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const search = useDebounce(busqueda.trim());
  const [estado, setEstado] = useState<EstadoVenta | ''>('');
  const [todas, setTodas] = useState(false);

  const { datos, cargando, error, setError } = useConsulta(
    () =>
      ventasApi.listarVentas({
        search: search || undefined,
        estado: estado || undefined,
        todasLasSucursales: todas
      }),
    [search, estado, todas],
    'No se pudieron cargar las ventas',
    'ventas'
  );
  const ventas = datos ?? [];
  const senasViejas = ventas.filter(
    (v) => v.estado === 'senada' && v.senadaDesde && diasDesde(v.senadaDesde) >= DIAS_AVISO_SENA
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3 className="mb-0">Ventas</h3>
        <div className="d-flex gap-2">
          {esAdmin && (
            <Link className="btn btn-outline-secondary" to="/reportes?seccion=ventas">
              Informe
            </Link>
          )}
          <Link className="btn btn-primary" to="/ventas/nueva">
            + Nueva venta
          </Link>
        </div>
      </div>

      {senasViejas.length > 0 && !estado && (
        <Alert variant="warning">
          {senasViejas.length === 1 ? 'Hay una seña' : `Hay ${senasViejas.length} señas`} de más de{' '}
          {DIAS_AVISO_SENA} días sin completar: {senasViejas.map((v) => v.etiqueta).join(', ')}.
        </Alert>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <Form.Control
          type="search"
          className="flex-grow-1"
          style={{ minWidth: 220, flexBasis: 260 }}
          placeholder="Cliente, DNI, número de venta, IMEI o serial"
          aria-label="Buscar ventas"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <ButtonGroup aria-label="Estado" className="flex-wrap">
          {FILTROS.map((f) => (
            <ToggleButton
              key={f.valor || 'todas'}
              id={`ventas-estado-${f.valor || 'todas'}`}
              type="radio"
              name="ventas-estado"
              variant="outline-primary"
              value={f.valor}
              checked={estado === f.valor}
              onChange={() => setEstado(f.valor)}
            >
              {f.etiqueta}
            </ToggleButton>
          ))}
        </ButtonGroup>
        {esAdmin && (
          <Form.Check
            type="checkbox"
            id="ventas-todas-sucursales"
            label="Todas las sucursales"
            checked={todas}
            onChange={(e) => setTodas(e.target.checked)}
          />
        )}
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />

      {cargando && !datos ? (
        <Cargando />
      ) : (
        <TablaApilable hover responsive className="align-middle">
          <thead>
            <tr>
              <th>Venta</th>
              <th>Cliente</th>
              <th>Equipos</th>
              <th>Estado</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} {...filaClickeable(() => navigate(`/ventas/${v.id}`))}>
                <td>
                  <div className="font-mono">{v.etiqueta}</div>
                  <div className="small text-muted">
                    {formatearFecha(v.completadaEn ?? v.createdAt)}
                    {todas && v.sucursal && ` · ${v.sucursal.nombre}`}
                  </div>
                </td>
                <td>{nombreCompleto(v.cliente)}</td>
                <td className="small">{v.equipos.map((e) => describirEquipoStock(e)).join(' + ')}</td>
                <td>
                  <EstadoEnLista venta={v} />
                </td>
                <td className="text-end text-nowrap">
                  {formatearMonto(v.total, v.moneda)}
                  {v.saldo > 0 && (
                    <div className="small text-danger">Falta {formatearMonto(v.saldo, v.moneda)}</div>
                  )}
                  {aNumero(v.partePago) > 0 && (
                    <div className="small text-muted">Equipo: {formatearMonto(v.partePago, v.moneda)}</div>
                  )}
                </td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  {search || estado ? 'Ninguna venta coincide con la búsqueda' : 'Todavía no hay ventas'}
                </td>
              </tr>
            )}
          </tbody>
        </TablaApilable>
      )}
    </div>
  );
}

function EstadoEnLista({ venta: v }: { venta: VentaEnLista }) {
  const dias = v.senadaDesde ? diasDesde(v.senadaDesde) : 0;
  return (
    <>
      <Badge bg={VARIANTE_ESTADO_VENTA[v.estado]}>{ETIQUETA_ESTADO_VENTA[v.estado]}</Badge>
      {v.estado === 'reservada' && v.reservadaHasta && (
        <div className="small text-muted">Hasta {formatearFecha(v.reservadaHasta)}</div>
      )}
      {v.estado === 'senada' && (
        <div className={`small ${dias >= DIAS_AVISO_SENA ? 'text-danger fw-semibold' : 'text-muted'}`}>
          Hace {dias} {dias === 1 ? 'día' : 'días'}
        </div>
      )}
    </>
  );
}
