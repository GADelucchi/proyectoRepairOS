import { useState } from 'react';
import { Button, Card, Col, Form, Row, Spinner, Stack } from 'react-bootstrap';
import { DateInput } from '@/shared/components/DateInput';
import { useAccion } from '@/shared/hooks/useAccion';
import { convertirAFormatoBackend, convertirDesdeBackend } from '@/shared/utils/fechas';
import { textoONull } from '@/shared/utils/texto';
import * as ordenesApi from '../../api';
import type { SeccionOrdenProps } from './tipos';

interface FormularioDatos {
  reparacionSolicitada: string;
  detallesEsteticos: string;
  notasInternas: string;
  fechaPactada: string;
}

/** Reparación pedida, estado estético, notas internas y fecha pactada. */
export function DetallesCard({ orden, puedeEditar, onActualizada, onError }: SeccionOrdenProps) {
  const [form, setForm] = useState<FormularioDatos | null>(null);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(onError);

  const set = (campo: keyof FormularioDatos, valor: string) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  function abrirEdicion() {
    setErrorFecha(null);
    setForm({
      reparacionSolicitada: orden.reparacionSolicitada ?? '',
      detallesEsteticos: orden.detallesEsteticos ?? '',
      notasInternas: orden.notasInternas ?? '',
      fechaPactada: convertirDesdeBackend(orden.fechaPactada)
    });
  }

  async function guardar() {
    if (!form) return;
    if (!form.reparacionSolicitada.trim()) {
      onError('La reparación solicitada no puede quedar vacía.');
      return;
    }
    const ok = await ejecutar(
      () =>
        ordenesApi.editarOrden(orden.id, {
          reparacionSolicitada: form.reparacionSolicitada.trim(),
          detallesEsteticos: textoONull(form.detallesEsteticos),
          notasInternas: textoONull(form.notasInternas),
          fechaPactada: convertirAFormatoBackend(form.fechaPactada)
        }),
      'No se pudieron guardar los cambios'
    );
    if (ok) {
      setForm(null);
      onActualizada('Datos de la orden actualizados.');
    }
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Detalles de la orden</span>
        {puedeEditar &&
          (form ? (
            <Stack direction="horizontal" gap={2}>
              <Button size="sm" variant="outline-secondary" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={guardar} disabled={enCurso || !!errorFecha}>
                {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
              </Button>
            </Stack>
          ) : (
            <Button size="sm" variant="outline-primary" onClick={abrirEdicion}>
              Editar
            </Button>
          ))}
      </Card.Header>
      <Card.Body>
        {form ? (
          <Row className="g-3">
            <Col md={12}>
              <Form.Group controlId="detalle-reparacion">
                <Form.Label>Reparación o revisión solicitada *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={form.reparacionSolicitada}
                  onChange={(e) => set('reparacionSolicitada', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group controlId="detalle-esteticos">
                <Form.Label>Detalles estéticos</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={form.detallesEsteticos}
                  onChange={(e) => set('detallesEsteticos', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group controlId="detalle-notas">
                <Form.Label>Notas internas (no visibles para el cliente)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={form.notasInternas}
                  onChange={(e) => set('notasInternas', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <DateInput
                label="Fecha pactada de entrega"
                value={form.fechaPactada}
                onChange={(v) => set('fechaPactada', v)}
                onValidityChange={setErrorFecha}
              />
            </Col>
          </Row>
        ) : (
          <Row className="g-3">
            <Dato titulo="Reparación solicitada" valor={orden.reparacionSolicitada} />
            <Dato
              titulo="Detalles estéticos"
              valor={orden.detallesEsteticos}
              vacio="Sin detalles registrados"
            />
            <Dato titulo="Notas internas" valor={orden.notasInternas} />
            <Dato titulo="Fecha pactada" valor={convertirDesdeBackend(orden.fechaPactada)} />
          </Row>
        )}
      </Card.Body>
    </Card>
  );
}

function Dato({ titulo, valor, vacio = '-' }: { titulo: string; valor?: string | null; vacio?: string }) {
  return (
    <Col md={6}>
      <div className="text-muted small">{titulo}</div>
      <div>{valor || vacio}</div>
    </Col>
  );
}
