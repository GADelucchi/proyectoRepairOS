import { FormEvent, useState } from 'react';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { NOMBRE_MONEDA } from '@/shared/constants/monedas';
import { CODIGOS_PAIS, PAISES, type CodigoPais } from '@/shared/constants/paises';
import { useAccion } from '@/shared/hooks/useAccion';
import * as configuracionApi from '../api';

interface DatosTallerCardProps {
  onError: (mensaje: string) => void;
  onGuardado: (mensaje: string) => void;
}

/**
 * Nombre y país del taller (solo admin). El país define la moneda con la que
 * arrancan las órdenes y el prefijo de los links de WhatsApp.
 */
export function DatosTallerCard({ onError, onGuardado }: DatosTallerCardProps) {
  const { usuario, refrescar } = useAuth();
  const [nombre, setNombre] = useState(usuario?.taller?.nombre ?? '');
  const [pais, setPais] = useState(usuario?.taller?.pais ?? 'AR');
  const { enCurso, ejecutar } = useAccion(onError);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const ok = await ejecutar(async () => {
      await configuracionApi.actualizarTaller({ nombre: nombre.trim(), pais });
      await refrescar();
    }, 'No se pudieron guardar los datos del taller');
    if (ok) onGuardado('Datos del taller guardados');
  }

  const moneda = PAISES[pais as CodigoPais]?.moneda;

  return (
    <Card className="mb-4" data-tour="datos-taller">
      <Card.Header>Datos del taller</Card.Header>
      <Card.Body>
        <Form onSubmit={guardar}>
          <Row className="g-2 align-items-end">
            <Col md={5}>
              <Form.Group controlId="taller-nombre">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={150}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="taller-pais">
                <Form.Label>País</Form.Label>
                <Form.Select value={pais} onChange={(e) => setPais(e.target.value)}>
                  {CODIGOS_PAIS.map((codigo) => (
                    <option key={codigo} value={codigo}>
                      {PAISES[codigo].nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md="auto">
              <Button type="submit" disabled={enCurso || !nombre.trim()}>
                {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
              </Button>
            </Col>
          </Row>
          {moneda && (
            <Form.Text className="text-muted">
              Las órdenes nuevas arrancan en {NOMBRE_MONEDA[moneda].toLowerCase()} ({moneda}). Las ya cargadas
              conservan su moneda.
            </Form.Text>
          )}
        </Form>
      </Card.Body>
    </Card>
  );
}
