import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Row,
  Table,
  ToggleButton
} from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { CampoEscaneable } from '@/shared/components/CampoEscaneable';
import { Cargando } from '@/shared/components/Cargando';
import { DateInput } from '@/shared/components/DateInput';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { CondicionEquipo, EquipoStock } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import {
  convertirDesdeBackend,
  fechaLocalISO,
  formatearFecha,
  formatearFechaHora
} from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';
import * as stockApi from '../api';
import {
  ALMACENAMIENTOS_GB,
  ETIQUETA_ESTADO_STOCK,
  VARIANTE_ESTADO_STOCK,
  describirEquipoStock,
  equipoAFormulario,
  esImeiValido,
  etiquetaNumero,
  formularioAInput,
  formularioVacio,
  imeiLeido,
  otroIgual,
  soloDigitos,
  textoAlmacenamiento,
  validarFormulario,
  type EquipoStockForm
} from '../stock-form';

/** Alta (`/stock/nuevo`) y edición (`/stock/:id`) de un equipo del stock. */
export function EquipoStockPage() {
  const { id } = useParams<{ id: string }>();
  const nuevo = id === undefined || id === 'nuevo';
  const { datos: equipo, error } = useConsulta(
    () => (nuevo ? Promise.resolve(null) : stockApi.obtenerEquipoStock(Number(id))),
    [id],
    'No se pudo cargar el equipo'
  );

  if (!nuevo && equipo === undefined) {
    return error ? <Alert variant="danger">{error}</Alert> : <Cargando />;
  }
  return <FormularioEquipoStock key={id ?? 'nuevo'} equipo={equipo ?? null} />;
}

interface FormularioEquipoStockProps {
  equipo: EquipoStock | null;
  /** Dentro de otra pantalla (la venta): al guardar se avisa en vez de volver al stock. */
  onGuardado?: (equipo: EquipoStock) => void;
  onCancelar?: () => void;
}

/** El formulario de un equipo. Se usa en su página y, para cargar uno nuevo sin salir, dentro de la venta. */
export function FormularioEquipoStock({ equipo, onGuardado, onCancelar }: FormularioEquipoStockProps) {
  const navigate = useNavigate();
  const incrustado = Boolean(onGuardado);
  const { esAdmin } = useAuth();
  const [form, setForm] = useState<EquipoStockForm>(() =>
    equipo ? equipoAFormulario(equipo) : formularioVacio(convertirDesdeBackend(fechaLocalISO()))
  );
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState<EquipoStock | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);
  const [darDeBaja, setDarDeBaja] = useState(false);
  const serialRef = useRef<HTMLInputElement>(null);
  const editable = !equipo || (equipo.estado !== 'vendido' && equipo.estado !== 'baja');
  // Los costos los ve solo un admin. Quien no lo es los carga al dar de alta, pero después no los ve.
  const verCostos = esAdmin || !equipo;
  const repetido = useRepetido(form, equipo?.id);

  function cambiar<K extends keyof EquipoStockForm>(campo: K, valor: EquipoStockForm[K]) {
    setForm((previo) => ({ ...previo, [campo]: valor }));
  }

  async function guardar(otro: boolean) {
    const invalido = validarFormulario(form, verCostos);
    if (invalido) {
      setError(invalido);
      return;
    }
    let guardado: EquipoStock | undefined;
    const ok = await ejecutar(async () => {
      const input = formularioAInput(form);
      guardado = equipo
        ? await stockApi.actualizarEquipoStock(equipo.id, input)
        : await stockApi.crearEquipoStock(input);
    }, 'No se pudo guardar el equipo');
    if (!ok || !guardado) return;

    if (otro) {
      setCargado(guardado);
      setForm(otroIgual(form));
      serialRef.current?.focus();
    } else if (onGuardado) {
      onGuardado(guardado);
    } else {
      navigate('/stock');
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    // En un modal, el submit sube por el árbol de React hasta el formulario de la pantalla de atrás.
    e.stopPropagation();
    guardar(false);
  }

  return (
    <div style={incrustado ? undefined : { maxWidth: 960 }}>
      {!incrustado && (
        <div className="small">
          <Link to="/stock">Stock</Link>
        </div>
      )}
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        {!incrustado && (
          <h3 className="mb-0">{equipo ? `Equipo ${etiquetaNumero(equipo.numero)}` : 'Cargar equipo'}</h3>
        )}
        {equipo && (
          <Badge bg={VARIANTE_ESTADO_STOCK[equipo.estado]}>{ETIQUETA_ESTADO_STOCK[equipo.estado]}</Badge>
        )}
        {equipo?.sucursal && <span className="text-muted small">Sucursal {equipo.sucursal.nombre}</span>}
      </div>

      {cargado && (
        <Alert variant="success" dismissible onClose={() => setCargado(null)}>
          Se cargó {etiquetaNumero(cargado.numero)}: {describirEquipoStock(cargado)}. Ahora escaneá el
          siguiente.
        </Alert>
      )}
      {equipo?.estado === 'vendido' && (
        <Alert variant="secondary">El equipo ya se vendió: sus datos quedan como estaban en la venta.</Alert>
      )}
      {equipo?.estado === 'baja' && (
        <Alert variant="dark">
          Dado de baja el {formatearFechaHora(equipo.bajaEn)}
          {equipo.bajaPor && ` por ${nombreCompleto(equipo.bajaPor)}`}: {equipo.motivoBaja}. Queda como
          registro y ya no cuenta en el stock.
        </Alert>
      )}
      {equipo?.recibidoEnVentaId && (
        <Alert variant="info">
          Entró como parte de pago en <Link to={`/ventas/${equipo.recibidoEnVentaId}`}>una venta</Link>.
        </Alert>
      )}
      <AlertaError error={error} onCerrar={() => setError(null)} />

      <Form onSubmit={enviar}>
        <fieldset disabled={!editable || enCurso}>
          <Card className="mb-3">
            <Card.Header>Equipo</Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group controlId="stock-marca">
                    <Form.Label>Marca</Form.Label>
                    <Form.Control
                      value={form.marca}
                      maxLength={100}
                      onChange={(e) => cambiar('marca', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="stock-modelo">
                    <Form.Label>Modelo</Form.Label>
                    <Form.Control
                      value={form.modelo}
                      maxLength={100}
                      onChange={(e) => cambiar('modelo', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="stock-color">
                    <Form.Label>Color</Form.Label>
                    <Form.Control
                      value={form.color}
                      maxLength={50}
                      onChange={(e) => cambiar('color', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Label htmlFor="stock-almacenamiento">Almacenamiento</Form.Label>
                  <InputGroup>
                    <Form.Control
                      id="stock-almacenamiento"
                      inputMode="numeric"
                      value={form.almacenamiento}
                      onChange={(e) => cambiar('almacenamiento', e.target.value)}
                    />
                    <Form.Select
                      aria-label="Unidad"
                      value={form.unidad}
                      style={{ maxWidth: 90 }}
                      onChange={(e) => cambiar('unidad', e.target.value as 'GB' | 'TB')}
                    >
                      <option value="GB">GB</option>
                      <option value="TB">TB</option>
                    </Form.Select>
                  </InputGroup>
                  <div className="d-flex flex-wrap gap-1 mt-2" role="group" aria-label="Tamaños comunes">
                    {ALMACENAMIENTOS_GB.map((gb) => (
                      <Button
                        key={gb}
                        size="sm"
                        variant="outline-secondary"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            almacenamiento: String(gb >= 1024 ? gb / 1024 : gb),
                            unidad: gb >= 1024 ? 'TB' : 'GB'
                          }))
                        }
                      >
                        {textoAlmacenamiento(gb)}
                      </Button>
                    ))}
                  </div>
                </Col>
                <Col md={6}>
                  <Form.Label as="div">Condición</Form.Label>
                  <ButtonGroup className="d-flex" aria-label="Condición">
                    {(['nuevo', 'usado'] as CondicionEquipo[]).map((c) => (
                      <ToggleButton
                        key={c}
                        id={`stock-condicion-${c}`}
                        type="radio"
                        name="stock-condicion"
                        variant="outline-primary"
                        value={c}
                        checked={form.condicion === c}
                        onChange={() => cambiar('condicion', c)}
                      >
                        {c === 'nuevo' ? 'Nuevo' : 'Usado'}
                      </ToggleButton>
                    ))}
                  </ButtonGroup>
                </Col>
                {form.condicion === 'usado' && (
                  <Col md={6}>
                    <Form.Label htmlFor="stock-bateria">Salud de la batería</Form.Label>
                    <InputGroup>
                      <Form.Control
                        id="stock-bateria"
                        inputMode="numeric"
                        value={form.bateria}
                        onChange={(e) => cambiar('bateria', e.target.value)}
                      />
                      <InputGroup.Text>%</InputGroup.Text>
                    </InputGroup>
                  </Col>
                )}
              </Row>
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Header>Identificación</Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label htmlFor="stock-serial">Número de serie</Form.Label>
                  <CampoEscaneable
                    id="stock-serial"
                    inputRef={serialRef}
                    autoCapitalize="characters"
                    value={form.numeroSerie}
                    maxLength={150}
                    tituloEscaner="Escanear número de serie"
                    onChange={(v) => cambiar('numeroSerie', v)}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label htmlFor="stock-imei">IMEI</Form.Label>
                  <CampoEscaneable
                    id="stock-imei"
                    inputMode="numeric"
                    value={form.imei}
                    isInvalid={imeiInvalido(form.imei)}
                    tituloEscaner="Escanear IMEI"
                    esperado="un IMEI"
                    aceptar={(texto) => imeiLeido(texto, form.imei2)}
                    onChange={(v) => cambiar('imei', v)}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label htmlFor="stock-imei2">
                    Segundo IMEI <span className="text-muted fw-normal">(equipos con dos SIM)</span>
                  </Form.Label>
                  <CampoEscaneable
                    id="stock-imei2"
                    inputMode="numeric"
                    value={form.imei2}
                    isInvalid={imeiInvalido(form.imei2)}
                    tituloEscaner="Escanear segundo IMEI"
                    esperado="un IMEI"
                    aceptar={(texto) => imeiLeido(texto, form.imei)}
                    onChange={(v) => cambiar('imei2', v)}
                  />
                </Col>
              </Row>
              {repetido && (
                <Alert variant="warning" className="mt-3 mb-0 py-2">
                  Ya está en el stock como{' '}
                  <Link to={`/stock/${repetido.id}`}>
                    {repetido.etiqueta} ({repetido.marca} {repetido.modelo})
                  </Link>
                  , {ETIQUETA_ESTADO_STOCK[repetido.estado].toLowerCase()}. No se puede cargar dos veces.
                </Alert>
              )}
              <Form.Text className="text-muted d-block mt-2">
                Escaneá la etiqueta de la caja con la cámara (el botón de cada campo) o con un lector USB o
                Bluetooth, haciendo clic en el campo.
              </Form.Text>
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Header>Compra y precio</Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <DateInput
                    label="Fecha de compra"
                    required
                    value={form.fechaCompra}
                    onChange={(v) => cambiar('fechaCompra', v)}
                  />
                </Col>
                <Col md={6}>
                  <Form.Group controlId="stock-proveedor">
                    <Form.Label>
                      Proveedor <span className="text-muted fw-normal">(opcional)</span>
                    </Form.Label>
                    <Form.Control
                      value={form.proveedor}
                      maxLength={150}
                      onChange={(e) => cambiar('proveedor', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                {verCostos && (
                  <Col md={6}>
                    <Form.Label htmlFor="stock-costo">Valor de compra</Form.Label>
                    <InputGroup>
                      <SelectorMoneda value={form.monedaCosto} onChange={(m) => cambiar('monedaCosto', m)} />
                      <Form.Control
                        id="stock-costo"
                        inputMode="decimal"
                        value={form.costo}
                        onChange={(e) => cambiar('costo', e.target.value)}
                      />
                    </InputGroup>
                    <Form.Text className="text-muted">
                      {esAdmin
                        ? 'Cada equipo guarda su propio costo.'
                        : 'Después de guardar, el costo lo ve solo un administrador.'}
                    </Form.Text>
                  </Col>
                )}
                <Col md={6}>
                  <Form.Label htmlFor="stock-precio">Valor de venta</Form.Label>
                  <InputGroup>
                    <SelectorMoneda value={form.monedaPrecio} onChange={(m) => cambiar('monedaPrecio', m)} />
                    <Form.Control
                      id="stock-precio"
                      inputMode="decimal"
                      value={form.precio}
                      onChange={(e) => cambiar('precio', e.target.value)}
                    />
                  </InputGroup>
                  <Form.Text className="text-muted">Precio de lista. Se puede cambiar al vender.</Form.Text>
                </Col>
                {verCostos && form.monedaCosto !== 'USD' && (
                  <Col md={6}>
                    <Form.Label htmlFor="stock-cotizacion">Cotización del día de compra</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>1 US$ =</InputGroup.Text>
                      <Form.Control
                        id="stock-cotizacion"
                        inputMode="decimal"
                        value={form.cotizacionCosto}
                        onChange={(e) => cambiar('cotizacionCosto', e.target.value)}
                      />
                      <InputGroup.Text>{form.monedaCosto}</InputGroup.Text>
                    </InputGroup>
                    <Form.Text className="text-muted">El informe de ventas se calcula en US$.</Form.Text>
                  </Col>
                )}
                <Col xs={12}>
                  <Form.Group controlId="stock-observaciones">
                    <Form.Label>
                      Observaciones <span className="text-muted fw-normal">(opcional)</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      maxLength={2000}
                      value={form.observaciones}
                      onChange={(e) => cambiar('observaciones', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {esAdmin && <MismoModeloEnStock form={form} excluirId={equipo?.id} />}

          <div className="d-flex flex-wrap gap-2 justify-content-end barra-acciones">
            {equipo && esAdmin && equipo.estado === 'disponible' && (
              <Button variant="outline-danger" className="me-auto" onClick={() => setDarDeBaja(true)}>
                Dar de baja
              </Button>
            )}
            {incrustado ? (
              <Button variant="link" onClick={onCancelar}>
                Cancelar
              </Button>
            ) : (
              <Link className="btn btn-link" to="/stock">
                Cancelar
              </Link>
            )}
            {!equipo && !incrustado && (
              <Button variant="outline-primary" onClick={() => guardar(true)}>
                Guardar y cargar otro igual
              </Button>
            )}
            <Button type="submit">Guardar</Button>
          </div>
        </fieldset>
      </Form>

      {equipo && (
        <DarDeBajaModal
          show={darDeBaja}
          equipo={equipo}
          onCerrar={() => setDarDeBaja(false)}
          onHecho={() => navigate('/stock')}
        />
      )}
    </div>
  );
}

const imeiInvalido = (imei: string) => soloDigitos(imei).length >= 15 && !esImeiValido(soloDigitos(imei));

/**
 * Si el IMEI o el serial que se está cargando ya está en el stock. Se pregunta
 * al terminar de escribir (o de escanear), así el aviso llega antes de guardar.
 */
function useRepetido(form: EquipoStockForm, excluirId?: number) {
  const imeis = [form.imei, form.imei2].map(soloDigitos).filter(esImeiValido);
  const serial = form.numeroSerie.trim();
  const clave = useDebounce(`${imeis.join(',')}|${serial.length >= 5 ? serial : ''}`, 400);
  const [repetido, setRepetido] = useState<stockApi.EquipoRepetido | null>(null);

  useEffect(() => {
    const [imeisClave, serialClave] = clave.split('|');
    const consultas = [
      ...imeisClave
        .split(',')
        .filter(Boolean)
        .map((imei) => ({ imei })),
      ...(serialClave ? [{ numeroSerie: serialClave }] : [])
    ];
    if (consultas.length === 0) {
      setRepetido(null);
      return;
    }
    let vigente = true;
    Promise.all(consultas.map((q) => stockApi.verificarRepetido({ ...q, excluirId })))
      .then((r) => vigente && setRepetido(r.find(Boolean) ?? null))
      .catch(() => vigente && setRepetido(null));
    return () => {
      vigente = false;
    };
  }, [clave, excluirId]);

  return repetido;
}

/**
 * Lo que hay en el stock del mismo modelo, con lo que costó cada uno (solo
 * admin): sirve para ver a cuánto se compró la última vez y poner el precio.
 */
function MismoModeloEnStock({ form, excluirId }: { form: EquipoStockForm; excluirId?: number }) {
  const marca = useDebounce(form.marca.trim().toLowerCase(), 500);
  const modelo = useDebounce(form.modelo.trim().toLowerCase(), 500);
  const gb = formularioAInput({ ...form, fechaCompra: '01/01/2000' }).almacenamientoGb;
  const { datos } = useConsulta(
    () =>
      modelo.length >= 2
        ? stockApi.listarStock({ search: modelo }).then((r) => r.equipos)
        : Promise.resolve([] as EquipoStock[]),
    [modelo],
    'No se pudo consultar el stock'
  );
  const iguales = (datos ?? []).filter(
    (e) =>
      e.id !== excluirId &&
      e.estado !== 'vendido' &&
      e.modelo.toLowerCase() === modelo &&
      (!marca || e.marca.toLowerCase() === marca) &&
      (!gb || e.almacenamientoGb === gb)
  );
  if (iguales.length === 0) return null;

  return (
    <Card className="mb-3">
      <Card.Header>
        Del mismo modelo en stock <span className="text-muted fw-normal">({iguales.length})</span>
      </Card.Header>
      <Card.Body className="p-0">
        <Table size="sm" responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Equipo</th>
              <th>Compra</th>
              <th className="text-end">Costo</th>
              <th className="text-end">Venta</th>
            </tr>
          </thead>
          <tbody>
            {iguales.map((e) => (
              <tr key={e.id}>
                <td className="font-mono small">
                  <Link to={`/stock/${e.id}`}>{etiquetaNumero(e.numero)}</Link>
                </td>
                <td className="small">
                  {describirEquipoStock(e)}{' '}
                  <Badge bg={VARIANTE_ESTADO_STOCK[e.estado]}>{ETIQUETA_ESTADO_STOCK[e.estado]}</Badge>
                </td>
                <td className="small text-muted">{formatearFecha(e.fechaCompra)}</td>
                <td className="text-end small">
                  {e.costo != null ? formatearMonto(e.costo, e.monedaCosto) : '—'}
                </td>
                <td className="text-end small">
                  {e.precio != null
                    ? formatearMonto(aNumero(e.precio), e.monedaPrecio ?? e.monedaCosto)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

/** Sacar el equipo del stock sin borrarlo: queda con el motivo. */
function DarDeBajaModal({
  show,
  equipo,
  onCerrar,
  onHecho
}: {
  show: boolean;
  equipo: EquipoStock;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (
      await ejecutar(() => stockApi.darDeBajaEquipoStock(equipo.id, motivo.trim()), 'No se pudo dar de baja')
    ) {
      onHecho();
    }
  }

  return (
    <Modal show={show} onHide={onCerrar} centered>
      <Form onSubmit={confirmar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Dar de baja {etiquetaNumero(equipo.numero)}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted">
            Sale del stock pero no se borra: queda registrado quién lo dio de baja, cuándo y por qué.
          </p>
          <AlertaError error={error} onCerrar={() => setError(null)} />
          <Form.Group controlId="baja-motivo">
            <Form.Label>Motivo</Form.Label>
            <Form.Control
              value={motivo}
              maxLength={255}
              placeholder="Carga duplicada, equipo dañado, devuelto al proveedor…"
              onChange={(e) => setMotivo(e.target.value)}
              required
              minLength={3}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Volver
          </Button>
          <Button type="submit" variant="danger" disabled={enCurso || motivo.trim().length < 3}>
            Dar de baja
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
