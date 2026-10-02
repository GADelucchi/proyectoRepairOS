import { FormEvent, useEffect, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { AlertaError } from '@/shared/components/AlertaError';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Cliente } from '@/shared/types';
import * as clientesApi from '../api';
import {
  CLIENTE_FORM_VACIO,
  ClienteFormData,
  clienteAFormulario,
  formularioAClienteInput
} from '../cliente-form';
import { ClienteFormFields } from './ClienteFormFields';

interface ClienteModalProps {
  show: boolean;
  /** null para dar de alta uno nuevo. */
  cliente: Cliente | null;
  esAdmin: boolean;
  onCerrar: () => void;
  onGuardado: () => void;
}

/** Alta y edición de un cliente. Los errores se muestran dentro del modal. */
export function ClienteModal({ show, cliente, esAdmin, onCerrar, onGuardado }: ClienteModalProps) {
  const [form, setForm] = useState<ClienteFormData>(CLIENTE_FORM_VACIO);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  useEffect(() => {
    if (!show) return;
    setForm(cliente ? clienteAFormulario(cliente) : CLIENTE_FORM_VACIO);
    setErrorFecha(null);
    setError(null);
  }, [show, cliente]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const datos = formularioAClienteInput(form);
    const ok = await ejecutar(
      () => (cliente ? clientesApi.actualizarCliente(cliente.id, datos) : clientesApi.crearCliente(datos)),
      'No se pudo guardar el cliente'
    );
    if (ok) onGuardado();
  }

  return (
    <Modal show={show} onHide={onCerrar}>
      <Form onSubmit={guardar}>
        <Modal.Header closeButton>
          <Modal.Title>{cliente ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} />
          <ClienteFormFields
            value={form}
            onChange={setForm}
            disabled={enCurso}
            onFechaInvalida={setErrorFecha}
            puedeEditarCuentaCorriente={esAdmin}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enCurso || !!errorFecha}>
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
