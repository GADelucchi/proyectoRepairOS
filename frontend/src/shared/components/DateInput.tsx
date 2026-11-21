import { useId, useRef, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { CalendarDays } from 'lucide-react';
import { convertirAFormatoBackend, convertirDesdeBackend, validarFechaDDMMYYYY } from '@/shared/utils/fechas';

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
 *
 * Se puede tipear o elegir en el almanaque del botón. El almanaque es el del
 * navegador (un `type="date"` transparente): el campo visible sigue en
 * DD/MM/AAAA aunque el sistema operativo esté en otro idioma.
 *
 * El `type="date"` va encima del botón y recibe el toque él mismo. En el
 * celular (sobre todo en iPhone) el selector de fecha solo se abre si se toca
 * el campo nativo: abrirlo desde el botón con `showPicker()` o `focus()` no hace
 * nada. En la compu, donde tocar el campo no siempre abre el almanaque, se
 * abre con `showPicker()`.
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
  const id = useId();
  const almanaque = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);

  function validar(fecha: string) {
    const nuevoError = validarFechaDDMMYYYY(fecha);
    setError(nuevoError);
    onValidityChange?.(nuevoError);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 8);

    let formatted = soloDigitos;
    if (soloDigitos.length > 4) {
      formatted = `${soloDigitos.slice(0, 2)}/${soloDigitos.slice(2, 4)}/${soloDigitos.slice(4)}`;
    } else if (soloDigitos.length > 2) {
      formatted = `${soloDigitos.slice(0, 2)}/${soloDigitos.slice(2)}`;
    }

    onChange(formatted);
    if (tocado) validar(formatted);
  }

  function handleBlur() {
    setTocado(true);
    validar(value);
  }

  /** Para la compu y el teclado (el botón de abajo). En el celular lo abre el toque. */
  function abrirAlmanaque() {
    try {
      almanaque.current?.showPicker();
    } catch {
      // Sin showPicker (o ya abierto por el toque): el navegador se encarga.
    }
  }

  function elegirEnAlmanaque(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const elegida = convertirDesdeBackend(e.target.value);
    onChange(elegida);
    setTocado(true);
    validar(elegida);
  }

  return (
    <Form.Group controlId={id}>
      {label && <Form.Label>{label}</Form.Label>}
      {/* El campo nativo va fuera del InputGroup: adentro le cambia los bordes redondeados al botón. */}
      <div className="position-relative">
        <InputGroup hasValidation>
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
          {/* Lo usa el teclado: con el mouse o el dedo se toca el campo nativo que tiene encima. */}
          <Button
            variant="outline-secondary"
            onClick={abrirAlmanaque}
            disabled={disabled}
            aria-label="Elegir la fecha en el almanaque"
            title="Elegir en el almanaque"
          >
            <CalendarDays size={16} aria-hidden="true" />
          </Button>
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </InputGroup>
        {/* Transparente y encima del botón: el toque le llega a él. Arranca en la fecha tipeada. */}
        <input
          ref={almanaque}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          title="Elegir en el almanaque"
          className="almanaque-oculto"
          value={convertirAFormatoBackend(value) ?? ''}
          disabled={disabled}
          onClick={abrirAlmanaque}
          onChange={elegirEnAlmanaque}
        />
      </div>
    </Form.Group>
  );
}
