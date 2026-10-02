import { FormEvent, useEffect, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { PasswordFields } from '@/features/auth/components/PasswordFields';
import { passwordListo } from '@/features/auth/password';
import { AlertaError } from '@/shared/components/AlertaError';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Usuario } from '@/shared/types';
import * as usuariosApi from '../api/usuarios';

interface CambiarPasswordModalProps {
  usuario: Usuario | null;
  onCerrar: () => void;
  onCambiada: () => void;
}

export function CambiarPasswordModal({ usuario, onCerrar, onCambiada }: CambiarPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  useEffect(() => {
    setPassword('');
    setConfirmacion('');
    setError(null);
  }, [usuario]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    const ok = await ejecutar(
      () => usuariosApi.cambiarPassword(usuario.id, password, confirmacion),
      'No se pudo cambiar la contraseña'
    );
    if (ok) onCambiada();
  }

  return (
    <Modal show={!!usuario} onHide={onCerrar}>
      <Form onSubmit={guardar}>
        <Modal.Header closeButton>
          <Modal.Title>Cambiar contraseña de {usuario?.nombre}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} />
          <PasswordFields
            label="Nueva contraseña"
            password={password}
            confirmacion={confirmacion}
            onPasswordChange={setPassword}
            onConfirmacionChange={setConfirmacion}
            disabled={enCurso}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enCurso || !passwordListo(password, confirmacion)}>
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
