import { Button, Form, InputGroup } from 'react-bootstrap';
import { X } from 'lucide-react';
import { ETIQUETA_MEDIO_PAGO, MEDIOS_PAGO } from '@/shared/constants/pagos';
import type { MedioPago, Moneda } from '@/shared/types';
import type { PagoForm } from '../venta-form';

interface PagosEditorProps {
  value: PagoForm[];
  onChange: (pagos: PagoForm[]) => void;
  moneda: Moneda;
  /** Lo que se muestra en el monto vacío del único pago: "todo lo que falta". */
  placeholder?: string;
  idPrefijo: string;
}

/** Uno o más pagos: "la mitad en efectivo y el resto por transferencia". */
export function PagosEditor({ value, onChange, moneda, placeholder, idPrefijo }: PagosEditorProps) {
  const cambiar = (i: number, cambios: Partial<PagoForm>) =>
    onChange(value.map((p, j) => (j === i ? { ...p, ...cambios } : p)));

  return (
    <div className="d-grid gap-2">
      {value.map((pago, i) => (
        <InputGroup key={i}>
          <Form.Select
            aria-label="Medio de pago"
            value={pago.medioPago}
            style={{ maxWidth: '50%' }}
            onChange={(e) => cambiar(i, { medioPago: e.target.value as MedioPago })}
          >
            {MEDIOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_MEDIO_PAGO[m]}
              </option>
            ))}
          </Form.Select>
          <InputGroup.Text>{moneda}</InputGroup.Text>
          <Form.Control
            id={`${idPrefijo}-monto-${i}`}
            aria-label="Monto"
            inputMode="decimal"
            value={pago.monto}
            placeholder={value.length === 1 ? placeholder : undefined}
            onChange={(e) => cambiar(i, { monto: e.target.value })}
          />
          {value.length > 1 && (
            <Button
              variant="outline-secondary"
              aria-label="Quitar este pago"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <X size={16} aria-hidden />
            </Button>
          )}
        </InputGroup>
      ))}
      <Button
        variant="link"
        size="sm"
        className="p-0 text-start"
        onClick={() => onChange([...value, { monto: '', medioPago: 'transferencia' }])}
      >
        + Otro medio de pago
      </Button>
    </div>
  );
}
