import { useState } from 'react';
import { Badge, Button, Card, ListGroup, Spinner, Stack } from 'react-bootstrap';
import { useAccion } from '@/shared/hooks/useAccion';
import * as ordenesApi from '../../api';
import type { ChequeoItem } from '../../checklist';
import { ChecklistEditor } from '../ChecklistEditor';
import type { SeccionOrdenProps } from './tipos';

export function ChequeosCard({ orden, puedeEditar, onActualizada, onError }: SeccionOrdenProps) {
  const [edicion, setEdicion] = useState<ChequeoItem[] | null>(null);
  const { enCurso, ejecutar } = useAccion(onError);
  const chequeos = orden.chequeos ?? [];

  function abrirEdicion() {
    setEdicion(
      chequeos.map((c) => ({
        item: c.item,
        resultado: c.resultado ?? null,
        opciones: c.opciones,
        orden: c.orden
      }))
    );
  }

  async function guardar() {
    if (!edicion) return;
    const ok = await ejecutar(
      () =>
        ordenesApi.reemplazarChequeos(
          orden.id,
          edicion.map((c, i) => ({ ...c, orden: i }))
        ),
      'No se pudo guardar el chequeo'
    );
    if (ok) {
      setEdicion(null);
      onActualizada('Chequeo actualizado.');
    }
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Chequeo de recepción</span>
        {puedeEditar &&
          (edicion ? (
            <Stack direction="horizontal" gap={2}>
              <Button size="sm" variant="outline-secondary" onClick={() => setEdicion(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={guardar} disabled={enCurso}>
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
        {edicion ? (
          <ChecklistEditor value={edicion} onChange={setEdicion} disabled={enCurso} />
        ) : chequeos.length > 0 ? (
          <ListGroup variant="flush">
            {chequeos.map((c) => (
              <ListGroup.Item key={c.id} className="d-flex justify-content-between px-0">
                <span>{c.item}</span>
                <Badge bg={c.resultado ? 'light' : 'secondary'} text={c.resultado ? 'dark' : undefined}>
                  {c.resultado ?? 'Sin responder'}
                </Badge>
              </ListGroup.Item>
            ))}
          </ListGroup>
        ) : (
          <span className="text-muted">Sin chequeos registrados</span>
        )}
      </Card.Body>
    </Card>
  );
}
