import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Form,
  InputGroup,
  Row,
  ToggleButton
} from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { DateInput } from '@/shared/components/DateInput';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { CondicionEquipo, EquipoStock } from '@/shared/types';
import { convertirDesdeBackend, fechaLocalISO } from '@/shared/utils/fechas';
import * as stockApi from '../api';
import {
  ALMACENAMIENTOS_GB,
  ETIQUETA_ESTADO_STOCK,
  VARIANTE_ESTADO_STOCK,
  describirEquipoStock,
  equipoAFormulario,
  etiquetaNumero,
  formularioAInput,
  formularioVacio,
  otroIgual,
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

function FormularioEquipoStock({ equipo }: { equipo: EquipoStock | null }) {
  const navigate = useNavigate();
  const { esAdmin } = useAuth();
  const [form, setForm] = useState<EquipoStockForm>(() =>
    equipo ? equipoAFormulario(equipo) : formularioVacio(convertirDesdeBackend(fechaLocalISO()))
  );
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState<EquipoStock | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);
  const serialRef = useRef<HTMLInputElement>(null);
  const editable = !equipo || equipo.estado !== 'vendido';

  function cambiar<K extends keyof EquipoStockForm>(campo: K, valor: EquipoStockForm[K]) {
    setForm((previo) => ({ ...previo, [campo]: valor }));
  }

  async function guardar(otro: boolean) {
    const invalido = validarFormulario(form);
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
    } else {
      navigate('/stock');
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar(false);
  }

  async function eliminar() {
    if (!equipo || !window.confirm(`¿Borrar ${etiquetaNumero(equipo.numero)} del stock?`)) return;
    if (await ejecutar(() => stockApi.eliminarEquipoStock(equipo.id), 'No se pudo borrar el equipo')) {
      navigate('/stock');
    }
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="small">
        <Link to="/stock">Stock</Link>
      </div>
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        <h3 className="mb-0">{equipo ? `Equipo ${etiquetaNumero(equipo.numero)}` : 'Cargar equipo'}</h3>
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
      {!editable && (
        <Alert variant="secondary">El equipo ya se vendió: sus datos quedan como estaban en la venta.</Alert>
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
                  <Form.Group controlId="stock-serial">
                    <Form.Label>Número de serie</Form.Label>
                    <Form.Control
                      ref={serialRef}
                      className="font-mono"
                      autoCapitalize="characters"
                      autoComplete="off"
                      value={form.numeroSerie}
                      maxLength={150}
                      onKeyDown={sinEnviarConEnter}
                      onChange={(e) => cambiar('numeroSerie', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="stock-imei">
                    <Form.Label>IMEI</Form.Label>
                    <Form.Control
                      className="font-mono"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.imei}
                      onKeyDown={sinEnviarConEnter}
                      onChange={(e) => cambiar('imei', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="stock-imei2">
                    <Form.Label>
                      Segundo IMEI <span className="text-muted fw-normal">(equipos con dos SIM)</span>
                    </Form.Label>
                    <Form.Control
                      className="font-mono"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.imei2}
                      onKeyDown={sinEnviarConEnter}
                      onChange={(e) => cambiar('imei2', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Text className="text-muted d-block mt-2">
                Con un lector de códigos USB o Bluetooth, hacé clic en el campo y escaneá la etiqueta de la
                caja. Si el IMEI o el serial ya están en el stock, se avisa al guardar.
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
                  <Form.Text className="text-muted">Cada equipo guarda su propio costo.</Form.Text>
                </Col>
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
                {form.monedaCosto !== 'USD' && (
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

          <div className="d-flex flex-wrap gap-2 justify-content-end barra-acciones">
            {equipo && esAdmin && equipo.estado === 'disponible' && (
              <Button variant="outline-danger" className="me-auto" onClick={eliminar}>
                Borrar del stock
              </Button>
            )}
            <Link className="btn btn-link" to="/stock">
              Cancelar
            </Link>
            {!equipo && (
              <Button variant="outline-primary" onClick={() => guardar(true)}>
                Guardar y cargar otro igual
              </Button>
            )}
            <Button type="submit">Guardar</Button>
          </div>
        </fieldset>
      </Form>
    </div>
  );
}

/**
 * Los lectores de código de barras "escriben" el número y mandan Enter: sin
 * esto, cada escaneo enviaría el formulario a medio llenar.
 */
function sinEnviarConEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.preventDefault();
}
