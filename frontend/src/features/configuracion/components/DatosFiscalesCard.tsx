import { FormEvent, useState } from 'react';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { DateInput } from '@/shared/components/DateInput';
import { CONDICIONES_IVA_EMISOR, ETIQUETA_CONDICION_IVA_EMISOR } from '@/shared/constants/fiscal';
import { useAccion } from '@/shared/hooks/useAccion';
import type { CondicionIvaEmisor } from '@/shared/types';
import { convertirAFormatoBackend, convertirDesdeBackend } from '@/shared/utils/fechas';
import { textoONull } from '@/shared/utils/texto';
import * as configuracionApi from '../api';

interface DatosFiscalesCardProps {
  onError: (mensaje: string) => void;
  onGuardado: (mensaje: string) => void;
}

/** Con qué datos factura el taller (solo admin). Cada taller carga los suyos. */
export function DatosFiscalesCard({ onError, onGuardado }: DatosFiscalesCardProps) {
  const { usuario, refrescar } = useAuth();
  const fiscal = usuario?.taller?.fiscal;
  const [razonSocial, setRazonSocial] = useState(fiscal?.razonSocial ?? '');
  const [cuit, setCuit] = useState(fiscal?.cuit ?? '');
  const [condicionIva, setCondicionIva] = useState<CondicionIvaEmisor | ''>(fiscal?.condicionIva ?? '');
  const [domicilioFiscal, setDomicilioFiscal] = useState(fiscal?.domicilioFiscal ?? '');
  const [inicioActividades, setInicioActividades] = useState(
    convertirDesdeBackend(fiscal?.inicioActividades)
  );
  const [ingresosBrutos, setIngresosBrutos] = useState(fiscal?.ingresosBrutos ?? '');
  const [puntoVenta, setPuntoVenta] = useState(fiscal?.puntoVenta ? String(fiscal.puntoVenta) : '');
  const { enCurso, ejecutar } = useAccion(onError);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const ok = await ejecutar(async () => {
      await configuracionApi.actualizarTaller({
        fiscal: {
          razonSocial: textoONull(razonSocial),
          cuit: textoONull(cuit),
          condicionIva: condicionIva || null,
          domicilioFiscal: textoONull(domicilioFiscal),
          inicioActividades: convertirAFormatoBackend(inicioActividades),
          ingresosBrutos: textoONull(ingresosBrutos),
          puntoVenta: puntoVenta.trim() ? Number(puntoVenta) : null
        }
      });
      await refrescar();
    }, 'No se pudieron guardar los datos fiscales');
    if (ok) onGuardado('Datos fiscales guardados');
  }

  return (
    <Card className="mb-4">
      <Card.Header>Datos fiscales</Card.Header>
      <Card.Body>
        <Form onSubmit={guardar}>
          <Row className="g-2">
            <Col md={6}>
              <Form.Group controlId="fiscal-razon-social">
                <Form.Label>Razón social o nombre</Form.Label>
                <Form.Control
                  value={razonSocial}
                  maxLength={150}
                  onChange={(e) => setRazonSocial(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="fiscal-cuit">
                <Form.Label>CUIT</Form.Label>
                <Form.Control
                  inputMode="numeric"
                  autoComplete="off"
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="fiscal-condicion">
                <Form.Label>Condición frente al IVA</Form.Label>
                <Form.Select
                  value={condicionIva}
                  onChange={(e) => setCondicionIva(e.target.value as CondicionIvaEmisor | '')}
                >
                  <option value="">Sin indicar</option>
                  {CONDICIONES_IVA_EMISOR.map((condicion) => (
                    <option key={condicion} value={condicion}>
                      {ETIQUETA_CONDICION_IVA_EMISOR[condicion]}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="fiscal-domicilio">
                <Form.Label>Domicilio fiscal</Form.Label>
                <Form.Control
                  value={domicilioFiscal}
                  maxLength={255}
                  onChange={(e) => setDomicilioFiscal(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <DateInput
                label="Inicio de actividades"
                value={inicioActividades}
                onChange={setInicioActividades}
              />
            </Col>
            <Col md={2}>
              <Form.Group controlId="fiscal-iibb">
                <Form.Label>Ingresos brutos</Form.Label>
                <Form.Control
                  value={ingresosBrutos}
                  maxLength={30}
                  onChange={(e) => setIngresosBrutos(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group controlId="fiscal-punto-venta">
                <Form.Label>Punto de venta</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={99998}
                  value={puntoVenta}
                  onChange={(e) => setPuntoVenta(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Text className="text-muted d-block mb-2">
            El punto de venta tiene que ser uno de tipo Web Services dado de alta en ARCA. Con guardar estos
            datos todavía no se emite ninguna factura.
          </Form.Text>
          <Button type="submit" disabled={enCurso}>
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
