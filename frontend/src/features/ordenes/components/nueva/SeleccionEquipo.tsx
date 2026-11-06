import { useCallback, useState } from 'react';
import { Alert, Button, Card, ListGroup, Spinner } from 'react-bootstrap';
import * as equiposApi from '@/features/equipos/api';
import { EquipoFormFields } from '@/features/equipos/components/EquipoFormFields';
import { useBusquedaPorSerie } from '@/features/equipos/hooks/useBusquedaPorSerie';
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
  const limpiar = () => {
    setReconocido(false);
    onChange({ existente: null, nuevo: null, texto: '' });
  };

  // Si la serie que se está cargando ya existe, se usa ese equipo (y la orden
  // completa el cliente con su dueño) en vez de cargarlo de nuevo.
  const [reconocido, setReconocido] = useState(false);
  const usarExistente = useCallback(
    (equipo: Equipo) => {
      setReconocido(true);
      onChange({ existente: equipo, nuevo: null, texto: describirEquipo(equipo) });
    },
    [onChange]
  );
  const porSerie = useBusquedaPorSerie(usarExistente);

  // Los equipos del cliente elegido, sin tener que tipear. Se guardan con el id del
  // cliente: si cambia, la lista deja de valer sin esperar a que nadie la limpie.
  const [suyos, setSuyos] = useState<{ clienteId: number; equipos: Equipo[] } | null>(null);
  const [buscandoSuyos, setBuscandoSuyos] = useState(false);
  const [errorSuyos, setErrorSuyos] = useState(false);
  const equiposDelCliente = clienteId && suyos?.clienteId === clienteId ? suyos.equipos : null;

  async function alternarEquiposDelCliente() {
    if (!clienteId) return;
    if (equiposDelCliente) {
      setSuyos(null);
      return;
    }
    setBuscandoSuyos(true);
    setErrorSuyos(false);
    try {
      setSuyos({ clienteId, equipos: await equiposApi.listarEquipos({ clienteId }) });
    } catch {
      setErrorSuyos(true);
    } finally {
      setBuscandoSuyos(false);
    }
  }

  const elegir = (equipo: Equipo) =>
    onChange({ existente: equipo, nuevo: null, texto: describirEquipo(equipo) });

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
              onSerieCompleta={porSerie.buscar}
              buscandoSerie={porSerie.buscando}
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
              onElegir={elegir}
              placeholder="Buscar equipo por marca, modelo o número de serie..."
            />
            {value.existente && (
              <Alert variant="success" className="mt-2 mb-0 py-2 d-flex justify-content-between">
                <span>
                  {reconocido ? 'Ese número de serie ya estaba cargado: ' : 'Seleccionado: '}
                  {describirEquipo(value.existente)}
                  {reconocido && value.existente.cliente && (
                    <> de {nombreCompleto(value.existente.cliente)}</>
                  )}
                </span>
                <Button variant="link" size="sm" onClick={limpiar}>
                  Cambiar
                </Button>
              </Alert>
            )}
            {clienteId && !value.existente && (
              <div className="mt-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  disabled={disabled || buscandoSuyos}
                  aria-expanded={Boolean(equiposDelCliente)}
                  onClick={alternarEquiposDelCliente}
                >
                  {buscandoSuyos ? <Spinner size="sm" animation="border" /> : 'Buscar en sus equipos'}
                </Button>
                {errorSuyos && (
                  <div className="text-danger small mt-1">No se pudieron cargar los equipos del cliente.</div>
                )}
                {equiposDelCliente &&
                  (equiposDelCliente.length === 0 ? (
                    <div className="text-muted small mt-1">
                      Este cliente todavía no tiene equipos cargados.
                    </div>
                  ) : (
                    <ListGroup className="mt-2">
                      {equiposDelCliente.map((eq) => (
                        <ListGroup.Item key={eq.id} action type="button" onClick={() => elegir(eq)}>
                          {describirEquipo(eq)}
                          {eq.numeroSerie && <span className="text-muted small"> · {eq.numeroSerie}</span>}
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  ))}
              </div>
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
