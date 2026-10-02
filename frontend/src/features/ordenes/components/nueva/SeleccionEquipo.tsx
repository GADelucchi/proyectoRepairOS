import { Alert, Button, Card } from 'react-bootstrap';
import * as equiposApi from '@/features/equipos/api';
import { EquipoFormFields } from '@/features/equipos/components/EquipoFormFields';
import { describirEquipo, EQUIPO_FORM_VACIO, EquipoFormData } from '@/features/equipos/equipo-form';
import { BuscadorConSugerencias } from '@/shared/components/BuscadorConSugerencias';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import type { Equipo, TipoEquipoPersonalizado } from '@/shared/types';
import { nombreCompleto } from '@/shared/utils/texto';

export interface EleccionEquipo {
  existente: Equipo | null;
  nuevo: EquipoFormData | null;
  texto: string;
}

interface SeleccionEquipoProps {
  value: EleccionEquipo;
  onChange: (value: EleccionEquipo) => void;
  /** Si ya hay un cliente elegido, la búsqueda se limita a sus equipos. */
  clienteId?: number;
  tiposEquipo: TipoEquipoPersonalizado[];
  disabled?: boolean;
}

/** Paso 2 de la orden nueva: buscar un equipo o cargar uno nuevo. */
export function SeleccionEquipo({ value, onChange, clienteId, tiposEquipo, disabled }: SeleccionEquipoProps) {
  const sugerencias = useBusqueda(
    value.texto,
    (search) => equiposApi.listarEquipos({ search, clienteId }),
    !value.existente && !value.nuevo,
    [clienteId]
  );
  const limpiar = () => onChange({ existente: null, nuevo: null, texto: '' });

  return (
    <Card className="h-100">
      <Card.Header>2. Equipo</Card.Header>
      <Card.Body>
        {value.nuevo ? (
          <>
            <EquipoFormFields
              value={value.nuevo}
              onChange={(nuevo) => onChange({ ...value, nuevo })}
              tiposEquipo={tiposEquipo}
              disabled={disabled}
            />
            <Button variant="outline-secondary" size="sm" className="mt-2" onClick={limpiar}>
              Volver a buscar un equipo existente
            </Button>
          </>
        ) : (
          <>
            <BuscadorConSugerencias
              texto={value.texto}
              onTextoChange={(texto) => onChange({ existente: null, nuevo: null, texto })}
              sugerencias={sugerencias}
              claveDe={(eq) => eq.id}
              mostrar={(eq) => `${describirEquipo(eq)} — ${nombreCompleto(eq.cliente)}`}
              onElegir={(eq) => onChange({ existente: eq, nuevo: null, texto: describirEquipo(eq) })}
              placeholder="Buscar equipo por marca, modelo o número de serie..."
            />
            {value.existente && (
              <Alert variant="success" className="mt-2 mb-0 py-2 d-flex justify-content-between">
                <span>Seleccionado: {describirEquipo(value.existente)}</span>
                <Button variant="link" size="sm" onClick={limpiar}>
                  Cambiar
                </Button>
              </Alert>
            )}
            <Button
              variant="outline-secondary"
              size="sm"
              className="mt-2"
              onClick={() => onChange({ existente: null, nuevo: EQUIPO_FORM_VACIO, texto: '' })}
            >
              + El equipo no existe, cargar uno nuevo
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
