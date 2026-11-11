import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  ProgressBar,
  Row
} from 'react-bootstrap';
import { BatteryMedium, MapPin, MessageCircle, Phone, Search } from 'lucide-react';
import { useParams } from 'react-router';
import { Cargando } from '@/shared/components/Cargando';
import { Logo } from '@/shared/components/Logo';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { CondicionEquipo } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFechaHora } from '@/shared/utils/fechas';
import { linkWhatsApp, telefonoParaWhatsApp } from '@/shared/utils/whatsapp';
import { type Catalogo, consultarCatalogo, type EquipoCatalogo } from '../api';
import {
  FILTROS_INICIALES,
  filtrarCatalogo,
  type FiltrosCatalogo,
  nivelBateria,
  type OrdenCatalogo
} from '../filtros';

const CONDICIONES: { valor: CondicionEquipo | 'todos'; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'nuevo', etiqueta: 'Nuevos' },
  { valor: 'usado', etiqueta: 'Usados' }
];

const ORDENES: { valor: OrdenCatalogo; etiqueta: string }[] = [
  { valor: 'precio_asc', etiqueta: 'Menor precio' },
  { valor: 'precio_desc', etiqueta: 'Mayor precio' },
  { valor: 'modelo', etiqueta: 'Marca y modelo' }
];

/** "Apple iPhone 13 · 128 GB · Azul" */
const descripcion = (e: EquipoCatalogo) =>
  [`${e.marca} ${e.modelo}`, e.memoria, e.color].filter(Boolean).join(' · ');

/**
 * Catálogo público de un taller: los equipos que tiene en venta, con su precio.
 * Sin cuenta: lo abre cualquiera con el link que el taller comparte (en sus
 * redes, por WhatsApp). Solo existe si el taller lo activó en Configuración.
 */
export function CatalogoPage() {
  const codigo = useParams<{ codigo: string }>().codigo ?? '';
  const {
    datos: catalogo,
    cargando,
    error
  } = useConsulta(
    () => consultarCatalogo(codigo),
    [codigo],
    'Este catálogo no existe o el taller todavía no lo publicó.'
  );
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(FILTROS_INICIALES);

  useEffect(() => {
    if (catalogo) document.title = `Equipos en venta · ${catalogo.taller}`;
  }, [catalogo]);

  const equipos = useMemo(
    () => (catalogo ? filtrarCatalogo(catalogo.equipos, filtros) : []),
    [catalogo, filtros]
  );
  const marcas = useMemo(
    () => [...new Set(catalogo?.equipos.map((e) => e.marca))].sort((a, b) => a.localeCompare(b, 'es')),
    [catalogo]
  );

  const cambiar = <K extends keyof FiltrosCatalogo>(campo: K, valor: FiltrosCatalogo[K]) =>
    setFiltros((f) => ({ ...f, [campo]: valor }));
  const filtrando =
    filtros.texto !== '' || filtros.condicion !== 'todos' || filtros.marca !== '' || filtros.sucursal !== '';

  return (
    <Container className="py-4" style={{ maxWidth: 1040 }}>
      {cargando && !catalogo ? (
        <Cargando />
      ) : !catalogo ? (
        <div className="mx-auto" style={{ maxWidth: 480 }}>
          <div className="d-flex justify-content-center mb-3">
            <Logo size={36} />
          </div>
          <Alert variant="warning">{error}</Alert>
          <p className="small text-muted text-center">
            Si te pasaron este link, pedile al taller que te lo vuelva a enviar.
          </p>
        </div>
      ) : (
        <>
          <header className="mb-4">
            <div className="text-muted small">{catalogo.taller}</div>
            <h2 className="mb-1">Equipos en venta</h2>
            <div className="text-muted">
              {catalogo.total === 1 ? '1 equipo disponible' : `${catalogo.total} equipos disponibles`}
            </div>
          </header>

          {catalogo.total === 0 ? (
            <Alert variant="light" className="border">
              Por ahora no hay equipos en venta. Volvé a mirar en unos días.
            </Alert>
          ) : (
            <>
              <BarraDeFiltros
                filtros={filtros}
                marcas={marcas}
                sucursales={catalogo.sucursales.map((s) => s.nombre)}
                onCambiar={cambiar}
              />

              {equipos.length === 0 ? (
                <div className="text-center text-muted py-5">
                  <p className="mb-2">No hay equipos con esos filtros.</p>
                  <Button variant="outline-secondary" size="sm" onClick={() => setFiltros(FILTROS_INICIALES)}>
                    Ver todos
                  </Button>
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <span className="small text-muted">
                      {filtrando && (equipos.length === 1 ? '1 resultado' : `${equipos.length} resultados`)}
                    </span>
                    <Form.Select
                      size="sm"
                      aria-label="Ordenar"
                      value={filtros.orden}
                      onChange={(ev) => cambiar('orden', ev.target.value as OrdenCatalogo)}
                      style={{ width: 'auto' }}
                    >
                      {ORDENES.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                  <Row xs={1} sm={2} lg={3} className="g-3">
                    {equipos.map((e) => (
                      <Col key={e.codigo}>
                        <TarjetaEquipo equipo={e} catalogo={catalogo} />
                      </Col>
                    ))}
                  </Row>
                </>
              )}
            </>
          )}

          <Sucursales catalogo={catalogo} />

          <footer className="text-center text-muted small mt-4">
            <div>Precios sujetos a cambio. Actualizado el {formatearFechaHora(catalogo.generado)}.</div>
            <div className="d-flex justify-content-center mt-3 opacity-75">
              <Logo size={20} />
            </div>
          </footer>
        </>
      )}
    </Container>
  );
}

interface BarraDeFiltrosProps {
  filtros: FiltrosCatalogo;
  marcas: string[];
  sucursales: string[];
  onCambiar: <K extends keyof FiltrosCatalogo>(campo: K, valor: FiltrosCatalogo[K]) => void;
}

function BarraDeFiltros({ filtros, marcas, sucursales, onCambiar }: BarraDeFiltrosProps) {
  return (
    <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
      <InputGroup style={{ flex: '1 1 240px' }}>
        <InputGroup.Text>
          <Search size={16} aria-hidden="true" />
        </InputGroup.Text>
        <Form.Control
          type="search"
          placeholder="Buscar marca o modelo"
          aria-label="Buscar marca o modelo"
          value={filtros.texto}
          onChange={(ev) => onCambiar('texto', ev.target.value)}
        />
      </InputGroup>
      <ButtonGroup aria-label="Nuevos o usados">
        {CONDICIONES.map((c) => (
          <Button
            key={c.valor}
            variant={filtros.condicion === c.valor ? 'primary' : 'outline-secondary'}
            aria-pressed={filtros.condicion === c.valor}
            onClick={() => onCambiar('condicion', c.valor)}
          >
            {c.etiqueta}
          </Button>
        ))}
      </ButtonGroup>
      {marcas.length > 1 && (
        <Form.Select
          aria-label="Marca"
          value={filtros.marca}
          onChange={(ev) => onCambiar('marca', ev.target.value)}
          style={{ flex: '1 1 150px', maxWidth: 260 }}
        >
          <option value="">Marcas</option>
          {marcas.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Form.Select>
      )}
      {sucursales.length > 1 && (
        <Form.Select
          aria-label="Sucursal"
          value={filtros.sucursal}
          onChange={(ev) => onCambiar('sucursal', ev.target.value)}
          style={{ flex: '1 1 150px', maxWidth: 260 }}
        >
          <option value="">Sucursales</option>
          {sucursales.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Form.Select>
      )}
    </div>
  );
}

function TarjetaEquipo({ equipo: e, catalogo }: { equipo: EquipoCatalogo; catalogo: Catalogo }) {
  const sucursal = catalogo.sucursales.find((s) => s.nombre === e.sucursal);
  const whatsapp = telefonoParaWhatsApp(sucursal?.telefono, catalogo.pais);
  const mensaje = `Hola, me interesa el ${descripcion(e)} (${e.codigo}) a ${formatearMonto(e.precio, e.moneda)} que vi en el catálogo. ¿Sigue disponible?`;

  return (
    <Card className="h-100">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <Badge bg={e.condicion === 'nuevo' ? 'success' : 'secondary'}>
            {e.condicion === 'nuevo' ? 'Nuevo' : 'Usado'}
          </Badge>
          <span className="font-mono small text-muted">{e.codigo}</span>
        </div>
        <div className="small text-muted">{e.marca}</div>
        <h5 className="mb-1">{e.modelo}</h5>
        <div className="small text-muted mb-2">{[e.memoria, e.color].filter(Boolean).join(' · ') || ' '}</div>

        {e.condicion === 'usado' && e.bateria != null && (
          <div className="mb-2">
            <div className="d-flex justify-content-between small mb-1">
              <span className="d-inline-flex align-items-center gap-1">
                <BatteryMedium size={16} aria-hidden="true" /> Batería
              </span>
              <span className="fw-semibold">{e.bateria}%</span>
            </div>
            <ProgressBar
              now={e.bateria}
              variant={nivelBateria(e.bateria)}
              style={{ height: 6 }}
              aria-label={`Salud de la batería: ${e.bateria}%`}
            />
          </div>
        )}

        <div className="mt-auto pt-2">
          <div className="fs-4 fw-semibold">{formatearMonto(e.precio, e.moneda)}</div>
          {catalogo.sucursales.length > 1 && e.sucursal && (
            <div className="small text-muted d-flex align-items-center gap-1">
              <MapPin size={14} aria-hidden="true" /> {e.sucursal}
            </div>
          )}
          {whatsapp && (
            <Button
              as="a"
              href={linkWhatsApp(whatsapp, mensaje)}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline-success"
              size="sm"
              className="w-100 mt-2 d-inline-flex align-items-center justify-content-center gap-1"
            >
              <MessageCircle size={16} aria-hidden="true" /> Consultar por WhatsApp
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

/** Dónde ver los equipos: dirección y teléfono de cada sucursal que tiene alguno. */
function Sucursales({ catalogo }: { catalogo: Catalogo }) {
  const conDatos = catalogo.sucursales.filter((s) => s.direccion || s.telefono);
  if (conDatos.length === 0) return null;
  return (
    <section className="mt-5">
      <h6 className="text-muted text-uppercase small mb-3">
        {conDatos.length === 1 ? 'Dónde estamos' : 'Nuestras sucursales'}
      </h6>
      <Row xs={1} md={2} className="g-3">
        {conDatos.map((s) => (
          <Col key={s.nombre}>
            <div className="fw-semibold">{s.nombre}</div>
            {s.direccion && (
              <div className="small text-muted d-flex align-items-center gap-1">
                <MapPin size={14} aria-hidden="true" /> {s.direccion}
              </div>
            )}
            {s.telefono && (
              <div className="small text-muted d-flex align-items-center gap-1">
                <Phone size={14} aria-hidden="true" /> {s.telefono}
              </div>
            )}
          </Col>
        ))}
      </Row>
    </section>
  );
}
