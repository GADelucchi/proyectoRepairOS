import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { formularioAClienteInput } from '@/features/clientes/cliente-form';
import * as configuracionApi from '@/features/configuracion/api';
import { formularioAEquipo } from '@/features/equipos/equipo-form';
import { getApiErrorMessage } from '@/shared/api/client';
import { AlertaError } from '@/shared/components/AlertaError';
import { DateInput } from '@/shared/components/DateInput';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Cliente } from '@/shared/types';
import { aNumero } from '@/shared/utils/dinero';
import { convertirAFormatoBackend } from '@/shared/utils/fechas';
import { nombreCompleto, textoONull } from '@/shared/utils/texto';
import * as ordenesApi from '../api';
import { ChequeoItem, OPCIONES_POR_DEFECTO } from '../checklist';
import { ChecklistEditor } from '../components/ChecklistEditor';
import { ImageUploader } from '../components/ImageUploader';
import { EleccionCliente, SeleccionCliente } from '../components/nueva/SeleccionCliente';
import { EleccionEquipo, SeleccionEquipo } from '../components/nueva/SeleccionEquipo';

const SIN_ELEGIR = { existente: null, nuevo: null, texto: '' };

/** Problema que impide crear la orden, o null si el formulario está completo. */
function validar(
  cliente: EleccionCliente,
  equipo: EleccionEquipo,
  reparacion: string,
  fechaPactada: string,
  errorFechaCliente: string | null
): string | null {
  if (!cliente.existente && !cliente.nuevo) return 'Buscá y elegí un cliente, o cargá uno nuevo.';
  if (!equipo.existente && !equipo.nuevo) return 'Buscá y elegí un equipo, o cargá uno nuevo.';
  if (equipo.nuevo && !equipo.nuevo.tipoEquipoPersonalizadoId) return 'Elegí el tipo de equipo.';
  if (!reparacion.trim()) return 'Indicá la reparación o revisión a realizar.';
  if (cliente.nuevo && errorFechaCliente) return 'Revisá la fecha de nacimiento del cliente.';
  if (fechaPactada && !convertirAFormatoBackend(fechaPactada))
    return 'La fecha pactada de entrega no es válida.';
  return null;
}

/** Recepción de un equipo: cliente, equipo, estado estético, checklist y condiciones. */
export function OrdenNuevaPage() {
  const navigate = useNavigate();
  const { esAdmin } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { datos: tiposEquipo = [], error: errorTipos } = useConsulta(
    configuracionApi.listarTiposEquipo,
    [],
    'No se pudieron cargar los tipos de equipo'
  );

  const [cliente, setCliente] = useState<EleccionCliente>(SIN_ELEGIR);
  const [errorFechaCliente, setErrorFechaCliente] = useState<string | null>(null);
  const [equipo, setEquipo] = useState<EleccionEquipo>(SIN_ELEGIR);

  const [detallesEsteticos, setDetallesEsteticos] = useState('');
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [chequeos, setChequeos] = useState<ChequeoItem[]>([]);
  const [reparacionSolicitada, setReparacionSolicitada] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [fechaPactada, setFechaPactada] = useState('');
  const [presupuestoMonto, setPresupuestoMonto] = useState('');

  // El checklist sale del tipo del equipo, sea uno existente o uno que se está cargando.
  const tipoId = equipo.existente?.tipoEquipoPersonalizadoId ?? equipo.nuevo?.tipoEquipoPersonalizadoId ?? 0;
  // Un equipo cargado en otra sucursal puede tener un tipo que acá no está configurado.
  const nombreTipo =
    tiposEquipo.find((t) => t.id === tipoId)?.nombre ?? equipo.existente?.tipoEquipo?.nombre ?? 'este equipo';

  useEffect(() => {
    if (!tipoId) {
      setChequeos([]);
      return;
    }
    let vigente = true;
    configuracionApi
      .listarChequeos(tipoId)
      .then((data) => {
        if (!vigente) return;
        // Las opciones se copian y quedan guardadas junto con la orden.
        setChequeos(
          data.map((c, i) => ({
            item: c.texto,
            resultado: null,
            opciones: c.opciones?.length ? c.opciones : OPCIONES_POR_DEFECTO,
            orden: i
          }))
        );
      })
      .catch(() => {
        if (vigente) setChequeos([]);
      });
    return () => {
      vigente = false;
    };
  }, [tipoId]);

  function cambiarCliente(nuevo: EleccionCliente) {
    setCliente(nuevo);
    // Un equipo ya elegido tiene que ser del cliente: si se cambia de dueño, se vuelve a buscar.
    if (equipo.existente && nuevo.existente?.id !== equipo.existente.clienteId) setEquipo(SIN_ELEGIR);
  }

  function cambiarEquipo(nuevo: EleccionEquipo) {
    setEquipo(nuevo);
    // Elegir un equipo sin haber elegido cliente completa el cliente con su dueño.
    if (nuevo.existente?.cliente && !cliente.existente && !cliente.nuevo) {
      const dueno: Cliente = nuevo.existente.cliente;
      setCliente({ existente: dueno, nuevo: null, texto: nombreCompleto(dueno) });
    }
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    const problema = validar(cliente, equipo, reparacionSolicitada, fechaPactada, errorFechaCliente);
    if (problema) {
      setError(problema);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setError(null);
    setEnviando(true);
    let orden;
    try {
      orden = await ordenesApi.crearOrden({
        clienteId: cliente.existente?.id,
        nuevoCliente: cliente.nuevo ? formularioAClienteInput(cliente.nuevo) : undefined,
        equipoId: equipo.existente?.id,
        nuevoEquipo: equipo.nuevo ? formularioAEquipo(equipo.nuevo) : undefined,
        detallesEsteticos: textoONull(detallesEsteticos),
        reparacionSolicitada: reparacionSolicitada.trim(),
        notasInternas: textoONull(notasInternas),
        fechaPactada: convertirAFormatoBackend(fechaPactada),
        presupuestoMonto: presupuestoMonto.trim() ? aNumero(presupuestoMonto) : null,
        chequeos
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo crear la orden'));
      setEnviando(false);
      return;
    }

    // La orden ya existe: si las fotos fallan se avisa en el detalle, en vez de
    // dejar el formulario abierto e invitar a crearla de nuevo.
    let aviso: string | undefined;
    if (imagenes.length > 0) {
      try {
        await ordenesApi.subirImagenes(orden.id, imagenes);
      } catch (err) {
        aviso = `La orden se creó, pero no se pudieron subir las fotos: ${getApiErrorMessage(err, 'error desconocido')}. Podés subirlas desde acá.`;
      }
    }
    navigate(`/ordenes/${orden.id}`, { replace: true, state: aviso ? { aviso } : undefined });
  }

  return (
    <div>
      <h3 className="mb-3">Nueva orden de reparación</h3>
      <AlertaError error={error ?? errorTipos} />
      {tiposEquipo.length === 0 && !errorTipos && (
        <Alert variant="warning">No hay tipos de equipo configurados. Creá uno en Configuración.</Alert>
      )}

      <Form onSubmit={crear}>
        <Row className="g-3">
          <Col md={6}>
            <SeleccionCliente
              value={cliente}
              onChange={cambiarCliente}
              esAdmin={esAdmin}
              disabled={enviando}
              onFechaInvalida={setErrorFechaCliente}
            />
          </Col>
          <Col md={6}>
            <SeleccionEquipo
              value={equipo}
              onChange={cambiarEquipo}
              clienteId={cliente.existente?.id}
              tiposEquipo={tiposEquipo}
              disabled={enviando}
            />
          </Col>

          <Col md={12}>
            <Card>
              <Card.Header>3. Estado estético e imágenes</Card.Header>
              <Card.Body>
                <Form.Group className="mb-3" controlId="nueva-esteticos">
                  <Form.Label>Detalles estéticos (rayones, golpes, faltantes, etc.)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={detallesEsteticos}
                    onChange={(e) => setDetallesEsteticos(e.target.value)}
                  />
                </Form.Group>
                <Form.Label>Fotos del equipo</Form.Label>
                <ImageUploader files={imagenes} onChange={setImagenes} disabled={enviando} />
              </Card.Body>
            </Card>
          </Col>

          <Col md={12}>
            <Card>
              <Card.Header>4. Chequeo inicial</Card.Header>
              <Card.Body>
                {!tipoId ? (
                  <p className="text-muted mb-0">Elegí el equipo para ver los chequeos de su tipo.</p>
                ) : (
                  <>
                    <p className="text-muted small mb-2">
                      Chequeos de <strong>{nombreTipo}</strong>
                      {chequeos.length === 0 &&
                        ' (no tiene configurados en esta sucursal; podés agregar ítems sueltos)'}
                    </p>
                    <ChecklistEditor value={chequeos} onChange={setChequeos} disabled={enviando} />
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={12}>
            <Card>
              <Card.Header>5. Reparación / revisión y condiciones</Card.Header>
              <Card.Body>
                <Form.Group className="mb-3" controlId="nueva-reparacion">
                  <Form.Label>Reparación o revisión a realizar *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    required
                    value={reparacionSolicitada}
                    onChange={(e) => setReparacionSolicitada(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="nueva-notas">
                  <Form.Label>Notas internas (no visibles para el cliente)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={notasInternas}
                    onChange={(e) => setNotasInternas(e.target.value)}
                  />
                </Form.Group>
                <Row className="g-3">
                  <Col md={6}>
                    <DateInput
                      label="Fecha pactada de entrega"
                      value={fechaPactada}
                      onChange={setFechaPactada}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="nueva-presupuesto">
                      <Form.Label>Monto de presupuesto (estimado)</Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        step="0.01"
                        value={presupuestoMonto}
                        onChange={(e) => setPresupuestoMonto(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button variant="secondary" onClick={() => navigate('/ordenes')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? <Spinner size="sm" animation="border" /> : 'Crear orden'}
          </Button>
        </div>
      </Form>
    </div>
  );
}
