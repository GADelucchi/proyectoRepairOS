import { Alert, Button, Card } from 'react-bootstrap';
import * as clientesApi from '@/features/clientes/api';
import { CLIENTE_FORM_VACIO, ClienteFormData } from '@/features/clientes/cliente-form';
import { ClienteFormFields } from '@/features/clientes/components/ClienteFormFields';
import { BuscadorConSugerencias } from '@/shared/components/BuscadorConSugerencias';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import type { Cliente } from '@/shared/types';
import { nombreCompleto } from '@/shared/utils/texto';

export interface EleccionCliente {
  /** Cliente existente elegido en el buscador. */
  existente: Cliente | null;
  /** Datos de un cliente nuevo; null mientras se busca uno existente. */
  nuevo: ClienteFormData | null;
  texto: string;
}

interface SeleccionClienteProps {
  value: EleccionCliente;
  onChange: (value: EleccionCliente) => void;
  esAdmin: boolean;
  disabled?: boolean;
  onFechaInvalida: (error: string | null) => void;
}

/** Paso 1 de la orden nueva: buscar un cliente o cargar uno nuevo. */
export function SeleccionCliente({
  value,
  onChange,
  esAdmin,
  disabled,
  onFechaInvalida
}: SeleccionClienteProps) {
  const sugerencias = useBusqueda(value.texto, clientesApi.listarClientes, !value.existente && !value.nuevo);

  return (
    <Card className="h-100">
      <Card.Header>1. Cliente</Card.Header>
      <Card.Body>
        {value.nuevo ? (
          <>
            <ClienteFormFields
              value={value.nuevo}
              onChange={(nuevo) => onChange({ ...value, nuevo })}
              layout="grilla"
              disabled={disabled}
              onFechaInvalida={onFechaInvalida}
              puedeEditarCuentaCorriente={esAdmin}
              prefijoId="orden-cliente"
            />
            <Button
              variant="outline-secondary"
              size="sm"
              className="mt-2"
              onClick={() => onChange({ existente: null, nuevo: null, texto: '' })}
            >
              Volver a buscar un cliente existente
            </Button>
          </>
        ) : (
          <>
            <BuscadorConSugerencias
              texto={value.texto}
              onTextoChange={(texto) => onChange({ existente: null, nuevo: null, texto })}
              sugerencias={sugerencias}
              claveDe={(c) => c.id}
              mostrar={(c) => (
                <>
                  <strong>{nombreCompleto(c)}</strong> {c.dniCuit && `(${c.dniCuit})`}
                </>
              )}
              onElegir={(c) => onChange({ existente: c, nuevo: null, texto: nombreCompleto(c) })}
              placeholder="Buscar cliente por nombre, apellido o DNI..."
            />
            {value.existente && (
              <Alert variant="success" className="mt-2 mb-0 py-2 d-flex justify-content-between">
                <span>Seleccionado: {nombreCompleto(value.existente)}</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => onChange({ existente: null, nuevo: null, texto: '' })}
                >
                  Cambiar
                </Button>
              </Alert>
            )}
            <Button
              variant="outline-secondary"
              size="sm"
              className="mt-2"
              onClick={() => onChange({ existente: null, nuevo: CLIENTE_FORM_VACIO, texto: '' })}
            >
              + El cliente no existe, cargar uno nuevo
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
