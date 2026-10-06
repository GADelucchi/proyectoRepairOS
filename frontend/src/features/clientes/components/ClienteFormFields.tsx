import { Col, Form, Row } from 'react-bootstrap';
import { DateInput } from '@/shared/components/DateInput';
import type { ClienteFormData } from '../cliente-form';

interface ClienteFormFieldsProps {
  value: ClienteFormData;
  onChange: (value: ClienteFormData) => void;
  disabled?: boolean;
  /** `apilado` para modales angostos, `grilla` para el panel de la orden nueva. */
  layout?: 'apilado' | 'grilla';
  /** Reporta si la fecha de nacimiento tipeada es válida. */
  onFechaInvalida?: (error: string | null) => void;
  /** Solo un admin puede fiar, así que el resto ve el estado pero no lo cambia. */
  puedeEditarCuentaCorriente?: boolean;
  /** Prefijo de los ids de los campos, por si hay dos formularios en la misma pantalla. */
  prefijoId?: string;
}

/**
 * Campos de alta/edición de cliente.
 *
 * Es la única definición del formulario: la usan tanto la pantalla de Clientes
 * como el alta rápida dentro de una orden nueva, para que ambas guarden
 * exactamente los mismos datos.
 */
export function ClienteFormFields({
  value,
  onChange,
  disabled,
  layout = 'apilado',
  onFechaInvalida,
  puedeEditarCuentaCorriente = false,
  prefijoId = 'cliente'
}: ClienteFormFieldsProps) {
  const set = <K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) =>
    onChange({ ...value, [campo]: valor });

  const anchoMitad = layout === 'grilla' ? 6 : 12;

  return (
    <Row className="g-2">
      <Col md={anchoMitad}>
        <Form.Group controlId={`${prefijoId}-nombre`}>
          <Form.Label>Nombre *</Form.Label>
          <Form.Control
            required
            disabled={disabled}
            value={value.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={anchoMitad}>
        <Form.Group controlId={`${prefijoId}-apellido`}>
          <Form.Label>Apellido *</Form.Label>
          <Form.Control
            required
            disabled={disabled}
            value={value.apellido}
            onChange={(e) => set('apellido', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={anchoMitad}>
        <Form.Group controlId={`${prefijoId}-dniCuit`}>
          <Form.Label>DNI / CUIT</Form.Label>
          <Form.Control
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            value={value.dniCuit}
            onChange={(e) => set('dniCuit', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={anchoMitad}>
        <Form.Group controlId={`${prefijoId}-telefono`}>
          <Form.Label>Teléfono</Form.Label>
          <Form.Control
            disabled={disabled}
            value={value.telefono}
            onChange={(e) => set('telefono', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={anchoMitad}>
        <Form.Group controlId={`${prefijoId}-email`}>
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            disabled={disabled}
            value={value.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={anchoMitad}>
        <DateInput
          label="Fecha de nacimiento"
          value={value.fechaNacimiento}
          onChange={(v) => set('fechaNacimiento', v)}
          onValidityChange={onFechaInvalida}
          disabled={disabled}
          placeholder="DD/MM/YYYY"
        />
      </Col>

      <Col md={anchoMitad}>
        <Form.Group controlId={`${prefijoId}-direccion`}>
          <Form.Label>Dirección</Form.Label>
          <Form.Control
            disabled={disabled}
            value={value.direccion}
            onChange={(e) => set('direccion', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={anchoMitad}>
        <Form.Group controlId={`${prefijoId}-ciudad`}>
          <Form.Label>Ciudad</Form.Label>
          <Form.Control
            disabled={disabled}
            value={value.ciudad}
            onChange={(e) => set('ciudad', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={12}>
        <Form.Check
          type="checkbox"
          id={`${prefijoId}-es-gremio`}
          label="¿Es gremio?"
          disabled={disabled}
          checked={value.esGremio}
          onChange={(e) => set('esGremio', e.target.checked)}
        />
      </Col>

      <Col md={12}>
        <Form.Check
          type="checkbox"
          id={`${prefijoId}-cuenta-corriente`}
          label="Cuenta corriente (puede retirar equipos sin pagarlos)"
          disabled={disabled || !puedeEditarCuentaCorriente}
          checked={value.cuentaCorrienteHabilitada}
          onChange={(e) => set('cuentaCorrienteHabilitada', e.target.checked)}
        />
        {!puedeEditarCuentaCorriente && (
          <Form.Text className="text-muted">Solo un administrador puede habilitarla.</Form.Text>
        )}
      </Col>

      {value.esGremio && (
        <Col md={12}>
          <Form.Group controlId={`${prefijoId}-nombreGremio`}>
            <Form.Label>Nombre del gremio o local</Form.Label>
            <Form.Control
              disabled={disabled}
              value={value.nombreGremio}
              onChange={(e) => set('nombreGremio', e.target.value)}
              placeholder="ej: Asociación de Comerciantes"
            />
          </Form.Group>
        </Col>
      )}
    </Row>
  );
}
