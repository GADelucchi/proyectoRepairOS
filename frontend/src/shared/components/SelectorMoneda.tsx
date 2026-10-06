import { Form } from 'react-bootstrap';
import { MONEDAS, NOMBRE_MONEDA } from '@/shared/constants/monedas';
import type { Moneda } from '@/shared/types';

interface SelectorMonedaProps {
  value: Moneda;
  onChange: (moneda: Moneda) => void;
  disabled?: boolean;
  /** Para limitar la lista (por ejemplo, a las monedas en las que el cliente debe). */
  opciones?: readonly Moneda[];
  id?: string;
}

/** Desplegable de moneda. Muestra el código, que es lo que se ve en los montos. */
export function SelectorMoneda({ value, onChange, disabled, opciones = MONEDAS, id }: SelectorMonedaProps) {
  return (
    <Form.Select
      id={id}
      aria-label="Moneda"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Moneda)}
      style={{ maxWidth: 110 }}
    >
      {opciones.map((moneda) => (
        <option key={moneda} value={moneda} title={NOMBRE_MONEDA[moneda]}>
          {moneda}
        </option>
      ))}
    </Form.Select>
  );
}
