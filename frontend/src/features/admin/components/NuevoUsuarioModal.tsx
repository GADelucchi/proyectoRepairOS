import { FormEvent, useEffect, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { PasswordFields } from '@/features/auth/components/PasswordFields';
import { passwordListo } from '@/features/auth/password';
import { AlertaError } from '@/shared/components/AlertaError';
import { useAccion } from '@/shared/hooks/useAccion';
import type { RolUsuario } from '@/shared/types';
import * as usuariosApi from '../api/usuarios';

const VACIO: usuariosApi.CrearUsuarioInput = {
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  passwordConfirmacion: '',
  rol: 'tecnico'
};

interface NuevoUsuarioModalProps {
  show: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}

export function NuevoUsuarioModal({ show, onCerrar, onCreado }: NuevoUsuarioModalProps) {
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  useEffect(() => {
    if (show) {
      setForm(VACIO);
      setError(null);
    }
  }, [show]);

  const set = <K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (await ejecutar(() => usuariosApi.crearUsuario(form), 'No se pudo crear el usuario')) onCreado();
  }

  return (
    <Modal show={show} onHide={onCerrar}>
      <Form onSubmit={guardar}>
        <Modal.Header closeButton>
          <Modal.Title>Nuevo usuario</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} />
          <Form.Group className="mb-2" controlId="usuario-nombre">
            <Form.Label>Nombre</Form.Label>
            <Form.Control required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2" controlId="usuario-apellido">
            <Form.Label>Apellido</Form.Label>
            <Form.Control required value={form.apellido} onChange={(e) => set('apellido', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2" controlId="usuario-email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              required
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Form.Group>
          <PasswordFields
            password={form.password}
            confirmacion={form.passwordConfirmacion}
            onPasswordChange={(v) => set('password', v)}
            onConfirmacionChange={(v) => set('passwordConfirmacion', v)}
            disabled={enCurso}
          />
          <Form.Group className="mb-2" controlId="usuario-rol">
            <Form.Label>Rol</Form.Label>
            <Form.Select value={form.rol} onChange={(e) => set('rol', e.target.value as RolUsuario)}>
              <option value="tecnico">Técnico</option>
              <option value="admin">Admin</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={enCurso || !passwordListo(form.password, form.passwordConfirmacion)}
          >
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
