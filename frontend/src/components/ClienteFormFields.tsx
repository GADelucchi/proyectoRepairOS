import { Col, Form, Row } from 'react-bootstrap';
import { DateInput } from './DateInput';
import { Cliente } from '../types';
import { convertirDesdeBackend } from '../utils/dateFormat';

/** Datos de un cliente tal como los edita el usuario (fecha en DD/MM/YYYY). */
export interface ClienteFormData {
  nombre: string;
  apellido: string;
  dniCuit: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  direccion: string;
  esGremio: boolean;
  nombreGremio: string;
  cuentaCorrienteHabilitada: boolean;
}

export const CLIENTE_FORM_VACIO: ClienteFormData = {
  nombre: '',
  apellido: '',
  dniCuit: '',
  telefono: '',
  email: '',
  fechaNacimiento: '',
  direccion: '',
  esGremio: false,
  nombreGremio: '',
  cuentaCorrienteHabilitada: false
};

/** Carga un cliente existente en el formulario. */
export function clienteAFormulario(cliente: Cliente): ClienteFormData {
  return {
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    dniCuit: cliente.dniCuit ?? '',
    telefono: cliente.telefono ?? '',
    email: cliente.email ?? '',
    fechaNacimiento: convertirDesdeBackend(cliente.fechaNacimiento),
    direccion: cliente.direccion ?? '',
    esGremio: cliente.esGremio ?? false,
    nombreGremio: cliente.nombreGremio ?? '',
    cuentaCorrienteHabilitada: cliente.cuentaCorrienteHabilitada ?? false
  };
}

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
  puedeEditarCuentaCorriente = false
}: ClienteFormFieldsProps) {
  const set = <K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) =>
    onChange({ ...value, [campo]: valor });

  const anchoMitad = layout === 'grilla' ? 6 : 12;

  return (
    <Row className="g-2">
      <Col md={anchoMitad}>
        <Form.Group>
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
        <Form.Group>
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
        <Form.Group>
          <Form.Label>DNI / CUIT</Form.Label>
          <Form.Control
            disabled={disabled}
            value={value.dniCuit}
            onChange={(e) => set('dniCuit', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={anchoMitad}>
        <Form.Group>
          <Form.Label>Teléfono</Form.Label>
          <Form.Control
            disabled={disabled}
            value={value.telefono}
            onChange={(e) => set('telefono', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={anchoMitad}>
        <Form.Group>
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

      <Col md={12}>
        <Form.Group>
          <Form.Label>Dirección</Form.Label>
          <Form.Control
            disabled={disabled}
            value={value.direccion}
            onChange={(e) => set('direccion', e.target.value)}
          />
        </Form.Group>
      </Col>

      <Col md={12}>
        <Form.Check
          type="checkbox"
          id="cliente-es-gremio"
          label="¿Es gremio?"
          disabled={disabled}
          checked={value.esGremio}
          onChange={(e) => set('esGremio', e.target.checked)}
        />
      </Col>

      <Col md={12}>
        <Form.Check
          type="checkbox"
          id="cliente-cuenta-corriente"
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
          <Form.Group>
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
