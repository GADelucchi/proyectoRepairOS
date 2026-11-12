import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { AlertaError } from '@/shared/components/AlertaError';
import { useAccion } from '@/shared/hooks/useAccion';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Orden } from '@/shared/types';
import * as ordenesApi from '../api';

interface TercerizarModalProps {
  orden: Orden;
  show: boolean;
  onCerrar: () => void;
  onTercerizada: (orden: ordenesApi.OrdenConNotificacion) => void;
}

const VACIO = { nombre: '', direccion: '', telefono: '', email: '' };

/** DNI de 7 u 8 números o CUIT de 11: recién ahí vale la pena buscar. */
const digitos = (valor: string) => valor.replace(/\D/g, '');
const documentoCompleto = (valor: string) => [7, 8, 11].includes(digitos(valor).length);

/**
 * Manda el equipo a un taller externo o a un técnico de afuera.
 *
 * Al tipear el DNI o CUIT se busca: si es un taller que usa RepairOS, se
 * completan sus datos y, al confirmar, se le arma la orden y le llega el aviso.
 * Si no, se completan los datos con que se le mandó algo la última vez.
 *
 * El cliente no se entera: en el seguimiento sigue viendo "En reparación".
 */
export function TercerizarModal({ orden, show, onCerrar, onTercerizada }: TercerizarModalProps) {
  const [dniCuit, setDniCuit] = useState('');
  const [datos, setDatos] = useState(VACIO);
  const [trabajo, setTrabajo] = useState(orden.reparacionSolicitada ?? '');
  const [notaInterna, setNotaInterna] = useState('');
  const [busqueda, setBusqueda] = useState<ordenesApi.BusquedaDestino | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [usarRepairOS, setUsarRepairOS] = useState(true);
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [compartirClaves, setCompartirClaves] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  const documento = useDebounce(dniCuit, 400);

  // Cada vez que se abre arranca de cero, con el trabajo de la orden como base.
  useEffect(() => {
    if (!show) return;
    setDniCuit('');
    setDatos(VACIO);
    setTrabajo(orden.reparacionSolicitada ?? '');
    setNotaInterna('');
    setBusqueda(null);
    setUsarRepairOS(true);
    setSucursalId(null);
    setCompartirClaves(false);
    setError(null);
  }, [show, orden.reparacionSolicitada]);

  useEffect(() => {
    if (!show || !documentoCompleto(documento)) {
      setBusqueda(null);
      return;
    }
    let vigente = true;
    setBuscando(true);
    ordenesApi
      .buscarDestino(documento)
      .then((resultado) => {
        if (!vigente) return;
        setBusqueda(resultado);
        if (resultado.taller) {
          const [sucursal] = resultado.taller.sucursales;
          setSucursalId(sucursal?.id ?? null);
          setDatos({
            nombre: resultado.taller.nombre,
            direccion: sucursal?.direccion ?? '',
            telefono: sucursal?.telefono ?? '',
            email: resultado.anterior?.email ?? ''
          });
        } else if (resultado.anterior) {
          const a = resultado.anterior;
          setDatos({
            nombre: a.nombre,
            direccion: a.direccion ?? '',
            telefono: a.telefono ?? '',
            email: a.email ?? ''
          });
        }
      })
      // Si la búsqueda falla, se cargan los datos a mano: no es para cortar.
      .catch(() => vigente && setBusqueda(null))
      .finally(() => vigente && setBuscando(false));
    return () => {
      vigente = false;
    };
  }, [documento, show]);

  const taller = busqueda?.taller ?? null;
  const conRepairOS = Boolean(taller && usarRepairOS);
  const tieneClaves = Boolean(
    orden.equipo?.claveDesbloqueo || orden.equipo?.cuentaUsuario || orden.equipo?.cuentaPassword
  );

  function elegirSucursal(id: number) {
    setSucursalId(id);
    const sucursal = taller?.sucursales.find((s) => s.id === id);
    if (sucursal) {
      setDatos((d) => ({ ...d, direccion: sucursal.direccion ?? '', telefono: sucursal.telefono ?? '' }));
    }
  }

  const campo = (nombre: keyof typeof VACIO) => ({
    value: datos[nombre],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setDatos((d) => ({ ...d, [nombre]: e.target.value }))
  });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    let actualizada: ordenesApi.OrdenConNotificacion | undefined;
    const ok = await ejecutar(async () => {
      actualizada = await ordenesApi.tercerizarOrden(orden.id, {
        nombre: datos.nombre.trim(),
        dniCuit: dniCuit.trim() || null,
        direccion: datos.direccion.trim() || null,
        telefono: datos.telefono.trim() || null,
        email: datos.email.trim() || null,
        trabajo: trabajo.trim(),
        notaInterna: notaInterna.trim() || null,
        tallerDestinoId: conRepairOS ? taller!.id : null,
        sucursalDestinoId: conRepairOS ? sucursalId : null,
        compartirClaves: conRepairOS && compartirClaves
      });
    }, 'No se pudo mandar el equipo al taller externo');
    if (ok && actualizada) onTercerizada(actualizada);
  }

  return (
    <Modal show={show} onHide={onCerrar} centered size="lg">
      <Form onSubmit={enviar}>
        <Modal.Header closeButton>
          <Modal.Title>Mandar a un taller externo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            La orden pasa a <strong>Externo</strong>. El cliente no se entera: en el seguimiento sigue viendo
            &quot;En reparación&quot;.
          </p>
          <AlertaError error={error} onCerrar={() => setError(null)} />

          <Row className="g-2">
            <Col md={5}>
              <Form.Group controlId="tercerizar-dni">
                <Form.Label>DNI o CUIT</Form.Label>
                <div className="position-relative">
                  <Form.Control
                    value={dniCuit}
                    inputMode="numeric"
                    autoFocus
                    placeholder="Ej: 30-71234567-1"
                    onChange={(e) => setDniCuit(e.target.value)}
                  />
                  {buscando && (
                    <Spinner
                      size="sm"
                      animation="border"
                      className="position-absolute top-50 end-0 translate-middle-y me-2 text-muted"
                    />
                  )}
                </div>
                <Form.Text className="text-muted">
                  Si el taller usa RepairOS, se completan sus datos y le llega el equipo como orden.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={7}>
              <Form.Group controlId="tercerizar-nombre">
                <Form.Label>Taller o persona</Form.Label>
                <Form.Control required maxLength={150} {...campo('nombre')} />
              </Form.Group>
            </Col>
          </Row>

          {taller && (
            <Alert variant="success" className="mt-3 mb-0 py-2">
              <Form.Check
                type="switch"
                id="tercerizar-repairos"
                checked={usarRepairOS}
                onChange={(e) => setUsarRepairOS(e.target.checked)}
                label={
                  <>
                    <strong>{taller.nombre}</strong> usa RepairOS: se le arma la orden y le llega el aviso.
                    Cuando reciba el equipo, solo lo confirma.
                  </>
                }
              />
              {usarRepairOS && taller.sucursales.length > 1 && (
                <Form.Select
                  className="mt-2"
                  size="sm"
                  aria-label="Sucursal del taller destino"
                  value={sucursalId ?? ''}
                  onChange={(e) => elegirSucursal(Number(e.target.value))}
                >
                  {taller.sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                      {s.direccion ? ` · ${s.direccion}` : ''}
                    </option>
                  ))}
                </Form.Select>
              )}
            </Alert>
          )}
          {!taller && busqueda?.anterior && (
            <Form.Text className="text-muted d-block mt-2">
              Completamos los datos con los del último envío a este DNI o CUIT.
            </Form.Text>
          )}

          <Row className="g-2 mt-1">
            <Col md={12}>
              <Form.Group controlId="tercerizar-direccion">
                <Form.Label>Dirección</Form.Label>
                <Form.Control maxLength={255} {...campo('direccion')} />
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group controlId="tercerizar-telefono">
                <Form.Label>Teléfono</Form.Label>
                <Form.Control type="tel" maxLength={50} {...campo('telefono')} />
              </Form.Group>
            </Col>
            <Col md={7}>
              <Form.Group controlId="tercerizar-email">
                <Form.Label>Correo</Form.Label>
                <Form.Control type="email" maxLength={150} {...campo('email')} />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group controlId="tercerizar-trabajo">
                <Form.Label>Qué tiene que hacer</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  required
                  maxLength={2000}
                  value={trabajo}
                  onChange={(e) => setTrabajo(e.target.value)}
                />
                {conRepairOS && (
                  <Form.Text className="text-muted">
                    Es lo que el otro taller ve como reparación pedida. Los datos de tu cliente no se le
                    pasan: para ese taller, el cliente sos vos.
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group controlId="tercerizar-nota">
                <Form.Label>Nota interna (opcional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  maxLength={2000}
                  placeholder="Precio acordado, plazo… Queda en el historial y no la ve nadie de afuera."
                  value={notaInterna}
                  onChange={(e) => setNotaInterna(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>

          {conRepairOS && tieneClaves && (
            <Form.Check
              className="mt-3"
              id="tercerizar-claves"
              checked={compartirClaves}
              onChange={(e) => setCompartirClaves(e.target.checked)}
              label="Pasarle la clave de desbloqueo y las cuentas del equipo"
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCerrar} disabled={enCurso}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enCurso || !datos.nombre.trim() || !trabajo.trim()}>
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Mandar al externo'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
