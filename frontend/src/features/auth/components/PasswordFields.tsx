import { Form } from 'react-bootstrap';
import { REQUISITOS_PASSWORD, validarPassword } from '../password';

interface PasswordFieldsProps {
  password: string;
  confirmacion: string;
  onPasswordChange: (value: string) => void;
  onConfirmacionChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Contraseña + confirmación con la misma política que valida el backend.
 * Muestra el error a medida que se escribe en vez de esperar al submit.
 */
export function PasswordFields({
  password,
  confirmacion,
  onPasswordChange,
  onConfirmacionChange,
  disabled,
  label = 'Contraseña'
}: PasswordFieldsProps) {
  const errorPassword = password ? validarPassword(password) : null;
  const noCoinciden = confirmacion.length > 0 && password !== confirmacion;

  return (
    <>
      <Form.Group className="mb-2">
        <Form.Label>{label}</Form.Label>
        <Form.Control
          type="password"
          required
          autoComplete="new-password"
          disabled={disabled}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          isInvalid={!!errorPassword}
        />
        <Form.Control.Feedback type="invalid">{errorPassword}</Form.Control.Feedback>
        {!errorPassword && <Form.Text className="text-muted">{REQUISITOS_PASSWORD}</Form.Text>}
      </Form.Group>

      <Form.Group className="mb-2">
        <Form.Label>Repetir {label.toLowerCase()}</Form.Label>
        <Form.Control
          type="password"
          required
          autoComplete="new-password"
          disabled={disabled}
          value={confirmacion}
          onChange={(e) => onConfirmacionChange(e.target.value)}
          isInvalid={noCoinciden}
        />
        <Form.Control.Feedback type="invalid">Las contraseñas no coinciden.</Form.Control.Feedback>
      </Form.Group>
    </>
  );
}
