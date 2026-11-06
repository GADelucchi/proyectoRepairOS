import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap';
import { useMonedaDelTaller } from '@/features/auth/useAuth';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { ETIQUETA_MEDIO_PAGO, MEDIOS_PAGO } from '@/shared/constants/pagos';
import type { MedioPago } from '@/shared/types';
import type { PrecioForm } from '../precios-form';

const MAXIMO = 5;

interface PreciosAlternativosProps {
  value: PrecioForm[];
  onChange: (value: PrecioForm[]) => void;
  disabled?: boolean;
}

/**
 * Otros precios además del de lista: "US$ 100 de lista, $ 120.000 en efectivo".
 * Se le muestran al cliente y al entregar se pueden elegir con un clic.
 */
export function PreciosAlternativos({ value, onChange, disabled }: PreciosAlternativosProps) {
  const monedaDelTaller = useMonedaDelTaller();

  const cambiar = (indice: number, cambios: Partial<PrecioForm>) =>
    onChange(value.map((p, i) => (i === indice ? { ...p, ...cambios } : p)));

  return (
    <div className="mt-2">
      {value.map((precio, indice) => (
        <Row key={indice} className="g-2 mb-2 align-items-center">
          <Col xs={12} sm={5}>
            <Form.Select
              aria-label="Medio de pago del precio"
              value={precio.medioPago}
              disabled={disabled}
              onChange={(e) => cambiar(indice, { medioPago: e.target.value as MedioPago | '' })}
            >
              <option value="">Cualquier medio</option>
              {MEDIOS_PAGO.map((medio) => (
                <option key={medio} value={medio}>
                  {ETIQUETA_MEDIO_PAGO[medio]}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={9} sm={5}>
            <InputGroup>
              <SelectorMoneda
                value={precio.moneda}
                disabled={disabled}
                onChange={(moneda) => cambiar(indice, { moneda })}
              />
              <Form.Control
                aria-label="Monto del precio"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={precio.monto}
                disabled={disabled}
                onChange={(e) => cambiar(indice, { monto: e.target.value })}
              />
            </InputGroup>
          </Col>
          <Col xs={3} sm={2}>
            <Button
              variant="outline-secondary"
              className="w-100"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== indice))}
            >
              Quitar
            </Button>
          </Col>
        </Row>
      ))}
      {value.length < MAXIMO && (
        <Button
          size="sm"
          variant="outline-secondary"
          disabled={disabled}
          onClick={() => onChange([...value, { medioPago: 'efectivo', moneda: monedaDelTaller, monto: '' }])}
        >
          + Agregar otro precio
        </Button>
      )}
    </div>
  );
}
