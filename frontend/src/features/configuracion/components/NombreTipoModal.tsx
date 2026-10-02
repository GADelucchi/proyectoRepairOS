import { FormEvent, useEffect, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { AlertaError } from '@/shared/components/AlertaError';
import { useAccion } from '@/shared/hooks/useAccion';
import type { TipoEquipoPersonalizado } from '@/shared/types';
import * as configuracionApi from '../api';

interface NombreTipoModalProps {
  show: boolean;
  /** Tipo a renombrar, o null para crear uno nuevo. */
  tipo: TipoEquipoPersonalizado | null;
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}

/** Alta o cambio de nombre de un tipo de equipo. */
export function NombreTipoModal({ show, tipo, onCerrar, onGuardado }: NombreTipoModalProps) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  useEffect(() => {
    if (!show) return;
    setNombre(tipo?.nombre ?? '');
    setError(null);
  }, [show, tipo]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) {
      setError('El nombre del tipo de equipo es requerido');
      return;
    }
    const ok = await ejecutar(
      () =>
        tipo
          ? configuracionApi.renombrarTipoEquipo(tipo.id, limpio)
          : configuracionApi.crearTipoEquipo(limpio),
      'No se pudo guardar el tipo de equipo'
    );
    if (ok) onGuardado(tipo ? 'Tipo de equipo actualizado' : 'Tipo de equipo creado');
  }

  return (
    <Modal show={show} onHide={onCerrar}>
      <Form onSubmit={guardar}>
        <Modal.Header closeButton>
          <Modal.Title>{tipo ? 'Editar tipo de equipo' : 'Agregar tipo de equipo'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} />
          <Form.Group controlId="tipo-nombre">
            <Form.Label>Nombre del tipo de equipo</Form.Label>
            <Form.Control
              placeholder="Ej: iPhone, Samsung Galaxy, Notebook"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enCurso}>
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
