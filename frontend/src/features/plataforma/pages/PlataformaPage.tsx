import { useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Tab, Tabs } from 'react-bootstrap';
import { useSearchParams } from 'react-router';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { EstadoSuscripcion } from '@/shared/types';
import { formatearFecha, formatearFechaHora } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as plataformaApi from '../api';
import { EstadoSuscripcionBadge } from '../components/EstadoSuscripcionBadge';
import { TallerModal } from '../components/TallerModal';

/**
 * Administración de la plataforma: todos los talleres, sus suscripciones y sus
 * usuarios. Solo para los emails de `PLATFORM_ADMIN_EMAILS`.
 *
 * `?taller=<id>` abre el detalle de ese taller (es adonde llevan los avisos de
 * la campanita).
 */
export function PlataformaPage() {
  const [params, setParams] = useSearchParams();
  const tallerAbierto = Number(params.get('taller')) || null;
  const [version, setVersion] = useState(0);

  const { datos: planes = [] } = useConsulta(
    plataformaApi.listarPlanes,
    [],
    'No se pudieron cargar los planes',
    'plataforma.planes'
  );

  function abrirTaller(id: number | null) {
    setParams(id ? { taller: String(id) } : {}, { replace: true });
  }

  return (
    <div>
      <h3 className="mb-3">Plataforma</h3>
      <Tabs defaultActiveKey="resumen" className="mb-3" mountOnEnter>
        <Tab eventKey="resumen" title="Resumen">
          <Resumen version={version} onAbrirTaller={abrirTaller} />
        </Tab>
        <Tab eventKey="talleres" title="Talleres">
          <Talleres version={version} onAbrirTaller={abrirTaller} />
        </Tab>
        <Tab eventKey="usuarios" title="Usuarios">
          <Usuarios onAbrirTaller={abrirTaller} />
        </Tab>
      </Tabs>

      {tallerAbierto && (
        <TallerModal
          tallerId={tallerAbierto}
          planes={planes}
          onCerrar={() => abrirTaller(null)}
          onActualizado={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}

interface SeccionProps {
  version?: number;
  onAbrirTaller: (id: number) => void;
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: number; detalle?: string }) {
  return (
    <Card body className="h-100">
      <div className="text-muted small">{titulo}</div>
      <div className="fs-3 fw-semibold">{valor}</div>
      {detalle && <div className="text-muted small">{detalle}</div>}
    </Card>
  );
}

function Resumen({ version, onAbrirTaller }: SeccionProps) {
  const { datos, cargando, error } = useConsulta(
    plataformaApi.obtenerResumen,
    [version],
    'No se pudo cargar el resumen',
    'plataforma.resumen'
  );

  if (cargando && !datos) return <Cargando />;
  if (!datos) return <AlertaError error={error} />;
  const s = datos.suscripciones;

  return (
    <>
      <Row xs={2} md={4} className="g-3 mb-3">
        <Col>
          <Dato
            titulo="Talleres"
            valor={datos.talleres}
            detalle={`${datos.talleresUltimos7} nuevos en 7 días · ${datos.talleresUltimos30} en 30`}
          />
        </Col>
        <Col>
          <Dato
            titulo="Usuarios activos"
            valor={datos.usuarios}
            detalle={`${datos.usuariosHoy} entraron hoy · ${datos.usuariosUltimos7} en 7 días`}
          />
        </Col>
        <Col>
          <Dato
            titulo="Órdenes (30 días)"
            valor={datos.ordenesUltimos30}
            detalle="Entre todos los talleres"
          />
        </Col>
        <Col>
          <Dato
            titulo="Suscripciones"
            valor={s.activa}
            detalle={`activas · ${s.prueba} en prueba · ${s.porVencer} vencen en 7 días`}
          />
        </Col>
      </Row>

      <div className="d-flex flex-wrap gap-2 mb-3 small">
        <Badge bg="info">Prueba: {s.prueba}</Badge>
        <Badge bg="success">Activas: {s.activa}</Badge>
        <Badge bg="danger">Vencidas: {s.vencida}</Badge>
        <Badge bg="secondary">Canceladas: {s.cancelada}</Badge>
        <Badge bg="dark">Sin suscripción: {s.sinSuscripcion}</Badge>
      </div>

      <Card>
        <Card.Header>Últimos registros</Card.Header>
        <Card.Body className="p-0">
          <TablaTalleres talleres={datos.recientes} onAbrirTaller={onAbrirTaller} />
        </Card.Body>
      </Card>
    </>
  );
}

const FILTROS: { valor: EstadoSuscripcion | 'todas' | 'por_vencer'; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas las suscripciones' },
  { valor: 'prueba', etiqueta: 'En prueba' },
  { valor: 'activa', etiqueta: 'Activas' },
  { valor: 'por_vencer', etiqueta: 'Vencen en 7 días' },
  { valor: 'vencida', etiqueta: 'Vencidas' },
  { valor: 'cancelada', etiqueta: 'Canceladas' }
];

function Talleres({ version, onAbrirTaller }: SeccionProps) {
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda.trim());
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['valor']>('todas');

  const {
    datos: talleres = [],
    cargando,
    error
  } = useConsulta(
    () => plataformaApi.listarTalleres(busquedaDebounced || undefined),
    [busquedaDebounced, version],
    'No se pudieron cargar los talleres',
    'plataforma.talleres'
  );

  const visibles = talleres.filter((t) => {
    const s = t.suscripcion;
    if (filtro === 'todas') return true;
    if (filtro === 'por_vencer')
      return !!s && !s.bloqueada && s.diasRestantes !== null && s.diasRestantes <= 7;
    return s?.estado === filtro;
  });

  return (
    <>
      <Row className="g-2 mb-3">
        <Col md>
          <Form.Control
            type="search"
            placeholder="Buscar por taller, nombre o email de un usuario..."
            aria-label="Buscar talleres"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Col>
        <Col md="auto">
          <Form.Select
            aria-label="Filtrar por suscripción"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as typeof filtro)}
          >
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </Form.Select>
        </Col>
      </Row>
      <AlertaError error={error} />
      {cargando ? (
        <Cargando />
      ) : (
        <Card>
          <Card.Body className="p-0">
            <TablaTalleres talleres={visibles} onAbrirTaller={onAbrirTaller} />
          </Card.Body>
        </Card>
      )}
    </>
  );
}

function TablaTalleres({
  talleres,
  onAbrirTaller
}: {
  talleres: plataformaApi.TallerPlataforma[];
  onAbrirTaller: (id: number) => void;
}) {
  if (talleres.length === 0) return <p className="text-muted p-3 mb-0">No hay talleres para mostrar.</p>;

  return (
    <TablaApilable hover responsive size="sm" className="mb-0 align-middle">
      <thead>
        <tr>
          <th>Taller</th>
          <th>Dueño</th>
          <th>Suscripción</th>
          <th className="text-end">Usuarios</th>
          <th className="text-end">Órdenes 30 d</th>
          <th>Último acceso</th>
          <th>Alta</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {talleres.map((t) => (
          <tr key={t.id} {...filaClickeable(() => onAbrirTaller(t.id))}>
            <td>
              {t.nombre}
              {t.esDemo && (
                <Badge bg="warning" text="dark" className="ms-1">
                  demo
                </Badge>
              )}
            </td>
            <td className="small">
              <div>{t.duenoNombre ?? '-'}</div>
              <div className="text-muted">{t.duenoEmail}</div>
            </td>
            <td>
              <EstadoSuscripcionBadge suscripcion={t.suscripcion} />
            </td>
            <td className="text-end">{t.usuarios}</td>
            <td className="text-end">{t.ordenesUltimos30}</td>
            <td className="small">{t.ultimoAcceso ? formatearFechaHora(t.ultimoAcceso) : 'nunca'}</td>
            <td className="small">{formatearFecha(t.createdAt)}</td>
            <td className="text-end">
              <Button size="sm" variant="outline-primary" onClick={() => onAbrirTaller(t.id)}>
                Ver
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </TablaApilable>
  );
}

function Usuarios({ onAbrirTaller }: SeccionProps) {
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda.trim());
  const {
    datos: usuarios = [],
    cargando,
    error
  } = useConsulta(
    () => plataformaApi.listarUsuarios(busquedaDebounced || undefined),
    [busquedaDebounced],
    'No se pudieron cargar los usuarios',
    'plataforma.usuarios'
  );

  return (
    <>
      <Form.Control
        type="search"
        className="mb-3"
        placeholder="Buscar por nombre, email o taller..."
        aria-label="Buscar usuarios"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      <AlertaError error={error} />
      {cargando ? (
        <Cargando />
      ) : (
        <Card>
          <Card.Body className="p-0">
            {usuarios.length === 0 ? (
              <p className="text-muted p-3 mb-0">No hay usuarios para mostrar.</p>
            ) : (
              <TablaApilable hover responsive size="sm" className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Taller</th>
                    <th>Rol</th>
                    <th>Último acceso</th>
                    <th>Alta</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr
                      key={u.id}
                      {...filaClickeable(() => u.tallerId && onAbrirTaller(u.tallerId))}
                      className={`fila-clickeable ${u.activo ? '' : 'text-muted'}`}
                    >
                      <td>
                        <div>
                          {nombreCompleto(u)}
                          {!u.activo && (
                            <Badge bg="secondary" className="ms-1">
                              baja
                            </Badge>
                          )}
                        </div>
                        <div className="small text-muted">{u.email}</div>
                      </td>
                      <td>
                        {u.tallerId && (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0"
                            onClick={() => onAbrirTaller(u.tallerId!)}
                          >
                            {u.taller}
                          </Button>
                        )}
                      </td>
                      <td className="small">{u.rol === 'admin' ? 'Admin' : 'Técnico'}</td>
                      <td className="small">
                        {u.ultimoAccesoAt ? formatearFechaHora(u.ultimoAccesoAt) : 'nunca'}
                      </td>
                      <td className="small">{formatearFecha(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </TablaApilable>
            )}
          </Card.Body>
        </Card>
      )}
    </>
  );
}
