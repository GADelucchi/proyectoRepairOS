import { FormEvent, useEffect, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { AlertaError } from '@/shared/components/AlertaError';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Sucursal } from '@/shared/types';
import { textoONull } from '@/shared/utils/texto';
import * as sucursalesApi from '../api/sucursales';

interface SucursalModalProps {
  show: boolean;
  /** null para crear una nueva. */
  sucursal: Sucursal | null;
  onCerrar: () => void;
  onGuardada: (sucursal: Sucursal, nueva: boolean) => void;
}

export function SucursalModal({ show, sucursal, onCerrar, onGuardada }: SucursalModalProps) {
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '' });
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  useEffect(() => {
    if (!show) return;
    setForm({
      nombre: sucursal?.nombre ?? '',
      direccion: sucursal?.direccion ?? '',
      telefono: sucursal?.telefono ?? ''
    });
    setError(null);
  }, [show, sucursal]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const datos = {
      nombre: form.nombre.trim(),
      direccion: textoONull(form.direccion),
      telefono: textoONull(form.telefono)
    };
    let guardada: Sucursal | undefined;
    const ok = await ejecutar(async () => {
      guardada = sucursal
        ? await sucursalesApi.actualizarSucursal(sucursal.id, datos)
        : await sucursalesApi.crearSucursal(datos);
    }, 'No se pudo guardar la sucursal');
    if (ok && guardada) onGuardada(guardada, !sucursal);
  }

  const campo = (clave: keyof typeof form, etiqueta: string, requerido = false) => (
    <Form.Group className="mb-2" controlId={`sucursal-${clave}`}>
      <Form.Label>{etiqueta}</Form.Label>
      <Form.Control
        required={requerido}
        value={form[clave]}
        onChange={(e) => setForm((f) => ({ ...f, [clave]: e.target.value }))}
      />
    </Form.Group>
  );

  return (
    <Modal show={show} onHide={onCerrar}>
      <Form onSubmit={guardar}>
        <Modal.Header closeButton>
          <Modal.Title>{sucursal ? 'Editar sucursal' : 'Nueva sucursal'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} />
          {campo('nombre', 'Nombre', true)}
          {campo('direccion', 'Dirección')}
          {campo('telefono', 'Teléfono')}
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
