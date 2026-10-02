import { ReactNode } from 'react';
import { Form, ListGroup } from 'react-bootstrap';

interface BuscadorConSugerenciasProps<T> {
  texto: string;
  onTextoChange: (texto: string) => void;
  sugerencias: T[];
  claveDe: (item: T) => string | number;
  mostrar: (item: T) => ReactNode;
  onElegir: (item: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Campo de búsqueda con una lista de resultados para elegir.
 * Los resultados son botones: se pueden elegir con el teclado, no solo con el mouse.
 */
export function BuscadorConSugerencias<T>({
  texto,
  onTextoChange,
  sugerencias,
  claveDe,
  mostrar,
  onElegir,
  placeholder,
  disabled
}: BuscadorConSugerenciasProps<T>) {
  return (
    <>
      <Form.Control
        placeholder={placeholder}
        aria-label={placeholder}
        value={texto}
        disabled={disabled}
        onChange={(e) => onTextoChange(e.target.value)}
      />
      {sugerencias.length > 0 && (
        <ListGroup className="mt-1 overflow-auto" style={{ maxHeight: 180 }}>
          {sugerencias.map((item) => (
            <ListGroup.Item key={claveDe(item)} action type="button" onClick={() => onElegir(item)}>
              {mostrar(item)}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </>
  );
}
