import { useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { Eye, EyeOff } from 'lucide-react';

interface CampoPasswordProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
}

/** Campo de contraseña con un botón para ver lo que se escribió y revisar si hay un error de tipeo. */
export function CampoPassword({ value, onChange, required, disabled, autoComplete }: CampoPasswordProps) {
  const [visible, setVisible] = useState(false);
  const accion = visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña';
  return (
    <InputGroup>
      <Form.Control
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        autoCapitalize="off"
        spellCheck={false}
      />
      <Button
        variant="outline-secondary"
        onClick={() => setVisible((v) => !v)}
        aria-label={accion}
        aria-pressed={visible}
        title={accion}
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </Button>
    </InputGroup>
  );
}
