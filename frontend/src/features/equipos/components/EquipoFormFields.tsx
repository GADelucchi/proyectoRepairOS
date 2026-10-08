import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import type { TipoEquipoPersonalizado } from '@/shared/types';
import type { EquipoFormData } from '../equipo-form';

interface EquipoFormFieldsProps {
  value: EquipoFormData;
  onChange: (value: EquipoFormData) => void;
  tiposEquipo: TipoEquipoPersonalizado[];
  disabled?: boolean;
  /** Si se pasa, aparece el botón para generar un número de serie único. */
  onGenerarSerie?: () => void;
  generandoSerie?: boolean;
  serieObligatoria?: boolean;
  /**
   * Se llama al terminar de escribir el número de serie (al salir del campo o
   * con Enter), para buscar si el equipo ya está cargado.
   */
  onSerieCompleta?: (numeroSerie: string) => void;
  /** Mientras se busca la serie en la base. */
  buscandoSerie?: boolean;
}

/**
 * Campos de un equipo. Los usan la pantalla de Equipos y el alta rápida dentro
 * de una orden nueva, así los dos formularios piden exactamente lo mismo.
 *
 * El número de serie va primero: es lo que identifica al equipo, y con él se
 * busca si ya estaba cargado antes de tipear el resto.
 */
export function EquipoFormFields({
  value,
  onChange,
  tiposEquipo,
  disabled,
  onGenerarSerie,
  generandoSerie,
  serieObligatoria = false,
  onSerieCompleta,
  buscandoSerie = false
}: EquipoFormFieldsProps) {
  const set = <K extends keyof EquipoFormData>(campo: K, valor: EquipoFormData[K]) =>
    onChange({ ...value, [campo]: valor });

  const campoTexto = (campo: keyof EquipoFormData, etiqueta: string, ancho = 6, placeholder?: string) => (
    <Col md={ancho}>
      <Form.Group controlId={`equipo-${campo}`}>
        <Form.Label className="small">{etiqueta}</Form.Label>
        <Form.Control
          value={value[campo] as string}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => set(campo, e.target.value)}
        />
      </Form.Group>
    </Col>
  );

  return (
    <Row className="g-2">
      <Col md={12}>
        <Form.Group controlId="equipo-numeroSerie">
          <Form.Label className="small">
            Número de serie {serieObligatoria && <span className="text-danger">*</span>}
          </Form.Label>
          <div className="d-flex gap-2">
            <Form.Control
              value={value.numeroSerie}
              placeholder={serieObligatoria ? '' : 'Si se deja vacío se genera uno'}
              disabled={disabled}
              autoComplete="off"
              onChange={(e) => set('numeroSerie', e.target.value)}
              onBlur={(e) => onSerieCompleta?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onSerieCompleta) {
                  // Enter busca el equipo en vez de mandar el formulario a medio completar.
                  e.preventDefault();
                  onSerieCompleta(e.currentTarget.value);
                }
              }}
            />
            {buscandoSerie && <Spinner size="sm" animation="border" className="align-self-center" />}
            {onGenerarSerie && (
              <Button
                variant="outline-secondary"
                onClick={onGenerarSerie}
                disabled={disabled || generandoSerie || !!value.numeroSerie.trim()}
                title={
                  value.numeroSerie.trim()
                    ? 'Limpiá el campo para generar uno nuevo'
                    : 'Generar número de serie único'
                }
              >
                {generandoSerie ? <Spinner size="sm" animation="border" /> : 'Generar'}
              </Button>
            )}
          </div>
        </Form.Group>
      </Col>

      <Col md={12}>
        <Form.Group controlId="equipo-tipo">
          <Form.Label className="small">
            Tipo de equipo <span className="text-danger">*</span>
          </Form.Label>
          <Form.Select
            value={value.tipoEquipoPersonalizadoId || ''}
            onChange={(e) => set('tipoEquipoPersonalizadoId', Number(e.target.value))}
            disabled={disabled || tiposEquipo.length === 0}
            required
          >
            <option value="">
              {tiposEquipo.length === 0
                ? 'No hay tipos configurados (ver Configuración)'
                : 'Elegí el tipo de equipo'}
            </option>
            {tiposEquipo.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
      {campoTexto('marca', 'Marca')}
      {campoTexto('modelo', 'Modelo')}
      {campoTexto('color', 'Color')}
      <Col md={12}>
        <p className="text-muted small mb-0 mt-2">Los siguientes datos se guardan cifrados.</p>
      </Col>
      {campoTexto('claveDesbloqueo', 'Clave de desbloqueo', 12)}
      {campoTexto('cuentaUsuario', 'Usuario de cuenta vinculada')}
      {campoTexto('cuentaPassword', 'Contraseña de cuenta vinculada')}
    </Row>
  );
}
