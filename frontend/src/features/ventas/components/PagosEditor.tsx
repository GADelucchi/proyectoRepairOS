import { Button, Form, InputGroup } from 'react-bootstrap';
import { X } from 'lucide-react';
import { SelectorMoneda } from '@/shared/components/SelectorMoneda';
import { ETIQUETA_MEDIO_PAGO, MEDIOS_PAGO } from '@/shared/constants/pagos';
import type { MedioPago, Moneda } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import {
  PAGO_VACIO,
  enMonedaDelPago,
  equivalenteDe,
  monedaDelPago,
  problemaDePago,
  restoDelSaldo,
  type PagoForm
} from '../venta-form';

interface PagosEditorProps {
  value: PagoForm[];
  onChange: (pagos: PagoForm[]) => void;
  /** La moneda de la venta. */
  moneda: Moneda;
  /** 1 US$ en la moneda de la venta, para proponerla en un pago en dólares. */
  cotizacionVenta?: string;
  /**
   * Lo que hay que cubrir. Si se pasa, el único pago sin monto es "lo que falta"
   * y muestra cuánto es en su moneda.
   */
  saldo?: number;
  /** Lo que se muestra en el monto vacío cuando no hay saldo que completar. */
  placeholder?: string;
  idPrefijo: string;
}

/**
 * Uno o más pagos: "la mitad en efectivo y el resto por transferencia", o
 * "US$ 900 y el resto en pesos". Cada pago va en la moneda en que entra la
 * plata; si no es la de la venta, con su cotización.
 */
export function PagosEditor({
  value,
  onChange,
  moneda,
  cotizacionVenta = '',
  saldo,
  placeholder,
  idPrefijo
}: PagosEditorProps) {
  const cambiar = (i: number, cambios: Partial<PagoForm>) =>
    onChange(value.map((p, j) => (j === i ? { ...p, ...cambios } : p)));

  function cambiarMoneda(i: number, nueva: Moneda) {
    const pago = value[i];
    // Si la venta no es en dólares, su cotización sirve para un pago en dólares.
    const cotizacion = pago.cotizacion || (nueva === 'USD' && moneda !== 'USD' ? cotizacionVenta : '');
    cambiar(i, { moneda: nueva === moneda ? null : nueva, cotizacion: nueva === moneda ? '' : cotizacion });
  }

  const vacios = value.filter((p) => !p.monto.trim());
  const resto = saldo !== undefined && vacios.length === 1 ? restoDelSaldo(value, saldo, moneda) : null;

  /** Para el monto vacío: todo lo que falta, en la moneda de ese pago. */
  function sugerido(pago: PagoForm): string | undefined {
    if (resto === null || pago !== vacios[0]) return value.length === 1 ? placeholder : undefined;
    const enSuMoneda = resto > 0 ? enMonedaDelPago(resto, pago, moneda) : null;
    if (enSuMoneda === null) return resto > 0 ? 'Falta la cotización' : undefined;
    const texto = formatearMonto(enSuMoneda, monedaDelPago(pago, moneda));
    return value.length === 1 ? `Todo: ${texto}` : `El resto: ${texto}`;
  }

  return (
    <div className="d-grid gap-2">
      {value.map((pago, i) => {
        const monedaPago = monedaDelPago(pago, moneda);
        const otraMoneda = monedaPago !== moneda;
        const monto = aNumero(pago.monto);
        const equivalente = otraMoneda && monto > 0 ? equivalenteDe(monto, pago, moneda) : null;
        const problema = otraMoneda ? problemaDePago(pago, moneda) : null;
        // La cotización se lee contra el dólar: "1 US$ = 1.200 ARS".
        const contraDolar = monedaPago === 'USD' ? moneda : monedaPago;

        return (
          <div key={i} className={otraMoneda ? 'border rounded p-2 d-grid gap-2' : undefined}>
            <InputGroup>
              <Form.Select
                aria-label="Medio de pago"
                value={pago.medioPago}
                style={{ maxWidth: '40%' }}
                onChange={(e) => cambiar(i, { medioPago: e.target.value as MedioPago })}
              >
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_MEDIO_PAGO[m]}
                  </option>
                ))}
              </Form.Select>
              <SelectorMoneda value={monedaPago} onChange={(m) => cambiarMoneda(i, m)} />
              <Form.Control
                id={`${idPrefijo}-monto-${i}`}
                aria-label={`Monto en ${monedaPago}`}
                inputMode="decimal"
                value={pago.monto}
                placeholder={sugerido(pago)}
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
            {otraMoneda && (
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <InputGroup size="sm" style={{ maxWidth: 260 }}>
                  <InputGroup.Text>1 US$ =</InputGroup.Text>
                  <Form.Control
                    id={`${idPrefijo}-cotizacion-${i}`}
                    aria-label={`Cotización: cuántos ${contraDolar} vale 1 US$`}
                    inputMode="decimal"
                    value={pago.cotizacion}
                    isInvalid={Boolean(pago.cotizacion) && Boolean(problema)}
                    onChange={(e) => cambiar(i, { cotizacion: e.target.value })}
                  />
                  <InputGroup.Text>{contraDolar}</InputGroup.Text>
                </InputGroup>
                <span className="small text-muted">
                  {problema && monedaPago !== 'USD' && moneda !== 'USD'
                    ? problema
                    : equivalente !== null
                      ? `Cubre ${formatearMonto(equivalente, moneda)}`
                      : null}
                </span>
              </div>
            )}
          </div>
        );
      })}
      <Button
        variant="link"
        size="sm"
        className="p-0 text-start"
        onClick={() => onChange([...value, { ...PAGO_VACIO, medioPago: 'transferencia' }])}
      >
        + Otro medio de pago
      </Button>
    </div>
  );
}
