import { KeyboardEvent, Ref, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { ScanBarcode } from 'lucide-react';
import { aMayusculas } from '@/shared/utils/texto';
import { EscanerCodigos } from './EscanerCodigos';

interface CampoEscaneableProps {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  /** Título del lector: "Escanear IMEI". */
  tituloEscaner: string;
  aceptar?: (texto: string) => string | null;
  esperado?: string;
  inputRef?: Ref<HTMLInputElement>;
  inputMode?: 'numeric' | 'text';
  /** Para números de serie: todo en mayúsculas, se escriba como se escriba. */
  mayusculas?: boolean;
  maxLength?: number;
  placeholder?: string;
  isInvalid?: boolean;
  onBlur?: () => void;
  /** Lo leído con la cámara, si se quiere tratar distinto de lo tipeado (por ejemplo, buscarlo enseguida). */
  onEscaneado?: (valor: string) => void;
  /** Enter en el campo: lo manda un lector USB al terminar de "escribir" el código. */
  onEnter?: () => void;
}

/**
 * Campo de texto con un botón para leer el código con la cámara. También sirve
 * un lector USB o Bluetooth: escribe en el campo, y el Enter que manda al final
 * no envía el formulario.
 */
export function CampoEscaneable({
  id,
  value,
  onChange,
  tituloEscaner,
  aceptar,
  esperado,
  inputRef,
  inputMode,
  mayusculas = false,
  maxLength,
  placeholder,
  isInvalid,
  onBlur,
  onEscaneado,
  onEnter
}: CampoEscaneableProps) {
  const [escaneando, setEscaneando] = useState(false);

  return (
    <>
      <InputGroup hasValidation>
        <Form.Control
          id={id}
          ref={inputRef}
          className="font-mono"
          inputMode={inputMode}
          autoCapitalize={mayusculas ? 'characters' : undefined}
          autoComplete="off"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          isInvalid={isInvalid}
          onKeyDown={(e) => {
            sinEnviarConEnter(e);
            if (e.key === 'Enter') onEnter?.();
          }}
          onChange={(e) => onChange(mayusculas ? aMayusculas(e.target) : e.target.value)}
          onBlur={onBlur}
        />
        <Button
          variant="outline-secondary"
          title={tituloEscaner}
          aria-label={tituloEscaner}
          onClick={() => setEscaneando(true)}
        >
          <ScanBarcode size={18} aria-hidden />
        </Button>
      </InputGroup>
      <EscanerCodigos
        show={escaneando}
        titulo={tituloEscaner}
        aceptar={aceptar}
        esperado={esperado}
        onCerrar={() => setEscaneando(false)}
        onLeido={(leido) => {
          setEscaneando(false);
          const valor = mayusculas ? leido.toUpperCase() : leido;
          if (onEscaneado) onEscaneado(valor);
          else onChange(valor);
        }}
      />
    </>
  );
}

/**
 * Los lectores de código de barras "escriben" el número y mandan Enter: sin
 * esto, cada escaneo enviaría el formulario a medio llenar.
 */
function sinEnviarConEnter(e: KeyboardEvent<HTMLElement>) {
  if (e.key === 'Enter') e.preventDefault();
}
