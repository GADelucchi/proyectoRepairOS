import { FormEvent, useState } from 'react';
import { Button, ButtonGroup, Card, Col, Form, InputGroup, Row, ToggleButton } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { Trash2 } from 'lucide-react';
import { useAuth, useMonedaDelTaller } from '@/features/auth/useAuth';
import { formularioAClienteInput } from '@/features/clientes/cliente-form';
import { EleccionCliente, SeleccionCliente } from '@/features/ordenes/components/nueva/SeleccionCliente';
import { describirEquipoStock, detalleCondicion, etiquetaNumero } from '@/features/stock/stock-form';
import { AlertaError } from '@/shared/components/AlertaError';
import { DateInput } from '@/shared/components/DateInput';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { useAccion } from '@/shared/hooks/useAccion';
import type { EquipoStock, Moneda, TipoDescuento } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import { fechaLocalISO } from '@/shared/utils/fechas';
import * as ventasApi from '../api';
import type { ModoVenta } from '../api';
import { BuscarEnStock } from '../components/BuscarEnStock';
import { PagosEditor } from '../components/PagosEditor';
import { PartePagoModal } from '../components/PartePagoModal';
import {
  ETIQUETA_MODO,
  conPreciosDeLista,
  formularioAVentaInput,
  precioEnMoneda,
  totalesDelFormulario,
  validarVenta,
  ventaVacia,
  type PartePagoForm,
  type VentaForm
} from '../venta-form';

const SIN_ELEGIR: EleccionCliente = { existente: null, nuevo: null, texto: '' };

const TEXTO_CONFIRMAR: Record<ModoVenta, string> = {
  venta: 'Confirmar venta',
  sena: 'Registrar seña',
  reserva: 'Reservar'
};

/**
 * Venta de equipos del stock: cliente, equipos que se lleva (buscándolos o
 * escaneándolos), lo que deja en parte de pago, descuento y cobro. Se puede
 * vender, señar (paga una parte) o reservar (sin pago, hasta una fecha).
 */
export function VentaNuevaPage() {
  const navigate = useNavigate();
  const { esAdmin } = useAuth();
  const monedaTaller = useMonedaDelTaller();
  const [cliente, setCliente] = useState<EleccionCliente>(SIN_ELEGIR);
  const [errorFechaCliente, setErrorFechaCliente] = useState<string | null>(null);
  const [form, setForm] = useState<VentaForm>(() => ventaVacia(monedaTaller));
  const [parteEditando, setParteEditando] = useState<number | 'nueva' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  const totales = totalesDelFormulario(form);
  const plata = (valor: number) => formatearMonto(valor, form.moneda);

  function cambiar<K extends keyof VentaForm>(campo: K, valor: VentaForm[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  /** Cambiar moneda o cotización recalcula los precios que no tocó el vendedor. */
  function cambiarCotizacion(cambios: { moneda?: Moneda; cotizacion?: string }) {
    setForm((f) => conPreciosDeLista({ ...f, ...cambios }));
  }

  function agregarEquipo(equipo: EquipoStock) {
    setForm((f) => {
      // El primer equipo define la moneda si todavía no se eligió nada: casi siempre se vende en la de lista.
      const moneda = f.items.length === 0 && equipo.monedaPrecio ? equipo.monedaPrecio : f.moneda;
      const precio = precioEnMoneda(equipo, moneda, aNumero(f.cotizacion));
      return {
        ...f,
        moneda,
        items: [...f.items, { equipo, precio: precio != null ? String(precio) : '', editado: false }]
      };
    });
  }

  function guardarParte(parte: PartePagoForm) {
    setForm((f) => ({
      ...f,
      partes:
        parteEditando === 'nueva'
          ? [...f.partes, parte]
          : f.partes.map((p, i) => (i === parteEditando ? parte : p))
    }));
    setParteEditando(null);
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    const problema =
      (!cliente.existente && !cliente.nuevo && 'Elegí el cliente o cargá uno nuevo.') ||
      (cliente.nuevo && errorFechaCliente && 'Revisá la fecha de nacimiento del cliente.') ||
      validarVenta(form, fechaLocalISO());
    if (problema) {
      setError(problema);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    let creada: { id: number } | undefined;
    const ok = await ejecutar(async () => {
      creada = await ventasApi.crearVenta({
        ...formularioAVentaInput(form),
        clienteId: cliente.existente?.id,
        nuevoCliente: cliente.nuevo ? formularioAClienteInput(cliente.nuevo) : undefined
      });
    }, 'No se pudo registrar la venta');
    if (ok && creada) navigate(`/ventas/${creada.id}`, { replace: true });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="small">
        <Link to="/ventas">Ventas</Link>
      </div>
      <h3 className="mb-3">Nueva venta</h3>
      <AlertaError error={error} onCerrar={() => setError(null)} />

      <Form onSubmit={confirmar}>
        <fieldset disabled={enCurso}>
          <Row className="g-3">
            <Col lg={7} className="d-grid gap-3 align-content-start">
              <SeleccionCliente
                value={cliente}
                onChange={setCliente}
                esAdmin={esAdmin}
                disabled={enCurso}
                onFechaInvalida={setErrorFechaCliente}
              />

              <Card>
                <Card.Header>2. Equipos que se lleva</Card.Header>
                <Card.Body>
                  <BuscarEnStock
                    excluir={form.items.map((i) => i.equipo.id)}
                    onElegir={agregarEquipo}
                    onError={setError}
                  />
                  {form.items.map((item, i) => (
                    <div key={item.equipo.id} className="border rounded p-2 mt-3">
                      <div className="d-flex justify-content-between gap-2">
                        <div>
                          <div className="fw-semibold">
                            <span className="font-mono text-muted me-2">
                              {etiquetaNumero(item.equipo.numero)}
                            </span>
                            {describirEquipoStock(item.equipo)}
                          </div>
                          <div className="small text-muted">
                            {detalleCondicion(item.equipo)}
                            {item.equipo.imei && ` · IMEI ${item.equipo.imei}`}
                            {!item.equipo.imei && item.equipo.numeroSerie && ` · ${item.equipo.numeroSerie}`}
                          </div>
                        </div>
                        <Button
                          variant="link"
                          className="text-danger p-0"
                          aria-label="Quitar de la venta"
                          onClick={() =>
                            cambiar(
                              'items',
                              form.items.filter((_, j) => j !== i)
                            )
                          }
                        >
                          <Trash2 size={18} aria-hidden />
                        </Button>
                      </div>
                      <InputGroup className="mt-2">
                        <InputGroup.Text>{form.moneda}</InputGroup.Text>
                        <Form.Control
                          aria-label="Precio de venta"
                          inputMode="decimal"
                          value={item.precio}
                          onChange={(e) =>
                            cambiar(
                              'items',
                              form.items.map((it, j) =>
                                j === i ? { ...it, precio: e.target.value, editado: true } : it
                              )
                            )
                          }
                        />
                      </InputGroup>
                      {item.equipo.precio != null && item.equipo.monedaPrecio && (
                        <div className="small text-muted mt-1">
                          Lista {formatearMonto(item.equipo.precio, item.equipo.monedaPrecio)}
                        </div>
                      )}
                    </div>
                  ))}
                </Card.Body>
              </Card>

              <Card>
                <Card.Header>3. Parte de pago</Card.Header>
                <Card.Body>
                  {form.partes.length === 0 && (
                    <p className="small text-muted">
                      Si el cliente deja un equipo, entra al stock al completar la venta.
                    </p>
                  )}
                  {form.partes.map((parte, i) => (
                    <div
                      key={i}
                      className="d-flex justify-content-between align-items-center border rounded p-2 mb-2"
                    >
                      <button
                        type="button"
                        className="btn btn-link text-start p-0 text-body"
                        onClick={() => setParteEditando(i)}
                      >
                        <div className="fw-semibold">
                          {parte.marca} {parte.modelo}
                        </div>
                        <div className="small text-muted">
                          {parte.imei ? `IMEI ${parte.imei}` : parte.numeroSerie}
                          {parte.bateria && ` · Batería ${parte.bateria}%`}
                        </div>
                      </button>
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-nowrap">- {plata(aNumero(parte.monto))}</span>
                        <Button
                          variant="link"
                          className="text-danger p-0"
                          aria-label="Quitar"
                          onClick={() =>
                            cambiar(
                              'partes',
                              form.partes.filter((_, j) => j !== i)
                            )
                          }
                        >
                          <Trash2 size={18} aria-hidden />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline-secondary" size="sm" onClick={() => setParteEditando('nueva')}>
                    + Agregar equipo que deja
                  </Button>
                </Card.Body>
              </Card>

              <Card>
                <Card.Header>4. Comentarios</Card.Header>
                <Card.Body>
                  <Form.Group className="mb-3" controlId="venta-comentario-cliente">
                    <Form.Label>Para el cliente</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      maxLength={2000}
                      placeholder="Garantía, accesorios incluidos…"
                      value={form.comentarioCliente}
                      onChange={(e) => cambiar('comentarioCliente', e.target.value)}
                    />
                    <Form.Text className="text-muted">Se imprime en el comprobante.</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="venta-comentario-interno">
                    <Form.Label>Internos</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      maxLength={2000}
                      value={form.comentarioInterno}
                      onChange={(e) => cambiar('comentarioInterno', e.target.value)}
                    />
                    <Form.Text className="text-muted">Solo los ve el taller.</Form.Text>
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={5}>
              <Card className="cobro-venta">
                <Card.Header>5. Cobro</Card.Header>
                <Card.Body className="d-grid gap-3">
                  <Row className="g-2">
                    <Col xs={form.moneda === 'USD' ? 12 : 5}>
                      <Form.Label htmlFor="venta-moneda">Moneda</Form.Label>
                      <SelectorMoneda
                        id="venta-moneda"
                        value={form.moneda}
                        onChange={(moneda) => cambiarCotizacion({ moneda })}
                      />
                    </Col>
                    {form.moneda !== 'USD' && (
                      <Col xs={7}>
                        <Form.Label htmlFor="venta-cotizacion">Cotización de hoy</Form.Label>
                        <InputGroup>
                          <InputGroup.Text>1 US$ =</InputGroup.Text>
                          <Form.Control
                            id="venta-cotizacion"
                            inputMode="decimal"
                            value={form.cotizacion}
                            onChange={(e) => cambiarCotizacion({ cotizacion: e.target.value })}
                          />
                        </InputGroup>
                      </Col>
                    )}
                  </Row>

                  <div>
                    <Form.Label htmlFor="venta-descuento">Descuento</Form.Label>
                    <InputGroup>
                      <Form.Select
                        aria-label="Tipo de descuento"
                        style={{ maxWidth: 110 }}
                        value={form.descuentoTipo}
                        onChange={(e) => cambiar('descuentoTipo', e.target.value as TipoDescuento)}
                      >
                        <option value="porcentaje">%</option>
                        <option value="monto">{form.moneda}</option>
                      </Form.Select>
                      <Form.Control
                        id="venta-descuento"
                        inputMode="decimal"
                        placeholder="0"
                        value={form.descuentoValor}
                        onChange={(e) => cambiar('descuentoValor', e.target.value)}
                      />
                    </InputGroup>
                  </div>

                  <dl className="row mb-0 small">
                    <dt className="col-7 fw-normal text-muted">Subtotal</dt>
                    <dd className="col-5 text-end mb-1">{plata(totales.subtotal)}</dd>
                    {totales.descuento > 0 && (
                      <>
                        <dt className="col-7 fw-normal text-muted">Descuento</dt>
                        <dd className="col-5 text-end mb-1">- {plata(totales.descuento)}</dd>
                      </>
                    )}
                    <dt className="col-7">Total</dt>
                    <dd className="col-5 text-end mb-1 fw-semibold">{plata(totales.total)}</dd>
                    {totales.partePago > 0 && (
                      <>
                        <dt className="col-7 fw-normal text-muted">Parte de pago</dt>
                        <dd className="col-5 text-end mb-1">- {plata(totales.partePago)}</dd>
                      </>
                    )}
                    <dt className="col-7 fs-6">A pagar</dt>
                    <dd className="col-5 text-end mb-0 fs-5 fw-semibold">{plata(totales.aPagar)}</dd>
                  </dl>

                  <ButtonGroup className="d-flex" aria-label="Cómo se cierra">
                    {(['venta', 'sena', 'reserva'] as ModoVenta[]).map((modo) => (
                      <ToggleButton
                        key={modo}
                        id={`venta-modo-${modo}`}
                        type="radio"
                        name="venta-modo"
                        variant="outline-primary"
                        value={modo}
                        checked={form.modo === modo}
                        onChange={() => cambiar('modo', modo)}
                      >
                        {ETIQUETA_MODO[modo]}
                      </ToggleButton>
                    ))}
                  </ButtonGroup>

                  {form.modo === 'reserva' ? (
                    <div>
                      <DateInput
                        label="Reservado hasta"
                        value={form.reservadaHasta}
                        onChange={(v) => cambiar('reservadaHasta', v)}
                      />
                      <Form.Text className="text-muted">
                        Sin pago. Pasada la fecha, los equipos vuelven solos al stock.
                      </Form.Text>
                    </div>
                  ) : (
                    <div>
                      <Form.Label as="div">{form.modo === 'sena' ? 'Seña' : 'Pago'}</Form.Label>
                      <PagosEditor
                        idPrefijo="venta-pago"
                        value={form.pagos}
                        onChange={(pagos) => cambiar('pagos', pagos)}
                        moneda={form.moneda}
                        cotizacionVenta={form.cotizacion}
                        saldo={form.modo === 'venta' ? totales.aPagar : undefined}
                        placeholder="Cuánto deja"
                      />
                      {form.modo === 'sena' && (
                        <Form.Text className="text-muted">
                          Los equipos quedan apartados. A los 15 días sin completar se avisa a los admins.
                        </Form.Text>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>

              <div className="d-flex gap-2 justify-content-end mt-3 barra-acciones">
                <Link className="btn btn-link" to="/ventas">
                  Cancelar
                </Link>
                <Button type="submit" className="flex-grow-1 flex-lg-grow-0">
                  {TEXTO_CONFIRMAR[form.modo]} ·{' '}
                  {plata(form.modo === 'reserva' ? totales.total : totales.aPagar)}
                </Button>
              </div>
            </Col>
          </Row>
        </fieldset>
      </Form>

      {parteEditando !== null && (
        <PartePagoModal
          show
          moneda={form.moneda}
          inicial={parteEditando === 'nueva' ? undefined : form.partes[parteEditando]}
          onGuardar={guardarParte}
          onCerrar={() => setParteEditando(null)}
        />
      )}
    </div>
  );
}
