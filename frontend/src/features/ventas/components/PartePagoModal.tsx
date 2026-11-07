import { FormEvent, useState } from 'react';
import { Button, Col, Form, InputGroup, Modal, Row } from 'react-bootstrap';
import {
  ALMACENAMIENTOS_GB,
  esImeiValido,
  imeiLeido,
  soloDigitos,
  textoAlmacenamiento
} from '@/features/stock/stock-form';
import { AlertaError } from '@/shared/components/AlertaError';
import { CampoEscaneable } from '@/shared/components/CampoEscaneable';
import type { Moneda } from '@/shared/types';
import { PARTE_VACIA, validarParte, type PartePagoForm } from '../venta-form';

interface PartePagoModalProps {
  show: boolean;
  moneda: Moneda;
  /** Para editar uno ya agregado. */
  inicial?: PartePagoForm;
  onGuardar: (parte: PartePagoForm) => void;
  onCerrar: () => void;
}

/**
 * Un equipo que deja el cliente como parte de pago. Entra al stock como usado
 * cuando se completa la venta, con lo que se le tomó como costo.
 */
export function PartePagoModal({ show, moneda, inicial, onGuardar, onCerrar }: PartePagoModalProps) {
  const [parte, setParte] = useState<PartePagoForm>(inicial ?? PARTE_VACIA);
  const [error, setError] = useState<string | null>(null);
  const cambiar = <K extends keyof PartePagoForm>(campo: K, valor: PartePagoForm[K]) =>
    setParte((p) => ({ ...p, [campo]: valor }));

  function guardar(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const problema = validarParte(parte);
    if (problema) {
      setError(problema);
      return;
    }
    onGuardar(parte);
  }

  const imeiMal = (v: string) => soloDigitos(v).length >= 15 && !esImeiValido(soloDigitos(v));

  return (
    <Modal show={show} onHide={onCerrar} centered fullscreen="sm-down" onExited={() => setError(null)}>
      <Form onSubmit={guardar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Equipo que deja el cliente</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} onCerrar={() => setError(null)} />
          <Row className="g-3">
            <Col xs={6}>
              <Form.Group controlId="parte-marca">
                <Form.Label>Marca</Form.Label>
                <Form.Control
                  value={parte.marca}
                  maxLength={100}
                  onChange={(e) => cambiar('marca', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={6}>
              <Form.Group controlId="parte-modelo">
                <Form.Label>Modelo</Form.Label>
                <Form.Control
                  value={parte.modelo}
                  maxLength={100}
                  onChange={(e) => cambiar('modelo', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Label as="div">Almacenamiento</Form.Label>
              <div className="d-flex flex-wrap gap-1" role="group" aria-label="Almacenamiento">
                {ALMACENAMIENTOS_GB.map((gb) => (
                  <Button
                    key={gb}
                    size="sm"
                    variant={parte.almacenamientoGb === String(gb) ? 'primary' : 'outline-secondary'}
                    onClick={() =>
                      cambiar('almacenamientoGb', parte.almacenamientoGb === String(gb) ? '' : String(gb))
                    }
                  >
                    {textoAlmacenamiento(gb)}
                  </Button>
                ))}
              </div>
            </Col>
            <Col xs={6}>
              <Form.Group controlId="parte-color">
                <Form.Label>Color</Form.Label>
                <Form.Control
                  value={parte.color}
                  maxLength={50}
                  onChange={(e) => cambiar('color', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={6}>
              <Form.Label htmlFor="parte-bateria">Batería</Form.Label>
              <InputGroup>
                <Form.Control
                  id="parte-bateria"
                  inputMode="numeric"
                  value={parte.bateria}
                  onChange={(e) => cambiar('bateria', e.target.value)}
                />
                <InputGroup.Text>%</InputGroup.Text>
              </InputGroup>
            </Col>
            <Col md={6}>
              <Form.Label htmlFor="parte-imei">IMEI</Form.Label>
              <CampoEscaneable
                id="parte-imei"
                inputMode="numeric"
                value={parte.imei}
                isInvalid={imeiMal(parte.imei)}
                tituloEscaner="Escanear IMEI"
                esperado="un IMEI"
                aceptar={(t) => imeiLeido(t, parte.imei2)}
                onChange={(v) => cambiar('imei', v)}
              />
              <Form.Text className="text-muted">En el equipo: marcá *#06#.</Form.Text>
            </Col>
            <Col md={6}>
              <Form.Label htmlFor="parte-serial">Número de serie</Form.Label>
              <CampoEscaneable
                id="parte-serial"
                mayusculas
                value={parte.numeroSerie}
                maxLength={150}
                tituloEscaner="Escanear número de serie"
                onChange={(v) => cambiar('numeroSerie', v)}
              />
            </Col>
            <Col xs={12}>
              <Form.Label htmlFor="parte-monto">Se le toma por</Form.Label>
              <InputGroup>
                <InputGroup.Text>{moneda}</InputGroup.Text>
                <Form.Control
                  id="parte-monto"
                  inputMode="decimal"
                  value={parte.monto}
                  onChange={(e) => cambiar('monto', e.target.value)}
                />
              </InputGroup>
              <Form.Text className="text-muted">
                Se descuenta de lo que paga y es el costo con el que entra al stock.
              </Form.Text>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="parte-observaciones">
                <Form.Label>
                  Estado del equipo <span className="text-muted fw-normal">(opcional)</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  maxLength={2000}
                  placeholder="Rayones, cambio de pantalla, caja…"
                  value={parte.observaciones}
                  onChange={(e) => cambiar('observaciones', e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit">{inicial ? 'Guardar' : 'Agregar'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
