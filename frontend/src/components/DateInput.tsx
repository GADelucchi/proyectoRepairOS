import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { validarFechaDDMMYYYY } from '../utils/dateFormat';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Se dispara al salir del campo con el mensaje de error, o null si es válida. */
  onValidityChange?: (error: string | null) => void;
}

/**
 * Campo de fecha DD/MM/YYYY con auto-formato y validación de calendario.
 * Avisa cuando la fecha no existe (31/02) en lugar de descartarla en silencio.
 */
export function DateInput({
  value,
  onChange,
  label,
  required,
  disabled,
  placeholder,
  onValidityChange
}: DateInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 8);

    let formatted = soloDigitos;
    if (soloDigitos.length > 4) {
      formatted = `${soloDigitos.slice(0, 2)}/${soloDigitos.slice(2, 4)}/${soloDigitos.slice(4)}`;
    } else if (soloDigitos.length > 2) {
      formatted = `${soloDigitos.slice(0, 2)}/${soloDigitos.slice(2)}`;
    }

    onChange(formatted);

    if (tocado) {
      const nuevoError = validarFechaDDMMYYYY(formatted);
      setError(nuevoError);
      onValidityChange?.(nuevoError);
    }
  }

  function handleBlur() {
    setTocado(true);
    const nuevoError = validarFechaDDMMYYYY(value);
    setError(nuevoError);
    onValidityChange?.(nuevoError);
  }

  return (
    <Form.Group>
      {label && <Form.Label>{label}</Form.Label>}
      <Form.Control
        type="text"
        inputMode="numeric"
        placeholder={placeholder || 'DD/MM/YYYY'}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        maxLength={10}
        isInvalid={!!error}
      />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
}
