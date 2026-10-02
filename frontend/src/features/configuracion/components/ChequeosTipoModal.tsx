import { useEffect, useState } from 'react';
import { Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import { OPCIONES_POR_DEFECTO } from '@/features/ordenes/checklist';
import { getApiErrorMessage } from '@/shared/api/client';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useAccion } from '@/shared/hooks/useAccion';
import type { ChequeoPersonalizado, OpcionChequeo, TipoEquipoPersonalizado } from '@/shared/types';
import * as configuracionApi from '../api';

/**
 * Un chequeo en edición lleva una clave propia y estable: sin ella React
 * reutiliza el input equivocado al borrar un elemento del medio de la lista.
 */
interface ChequeoEnEdicion {
  clave: string;
  texto: string;
  opciones: OpcionChequeo[];
}

let contadorClaves = 0;
const conClave = (c: Pick<ChequeoPersonalizado, 'texto' | 'opciones'>): ChequeoEnEdicion => ({
  clave: `chequeo-${++contadorClaves}`,
  texto: c.texto,
  opciones: c.opciones.map((o) => ({ etiqueta: o.etiqueta }))
});

/** Problema que impide guardar el checklist, o null si está completo. */
function validar(chequeos: ChequeoEnEdicion[]): string | null {
  if (chequeos.some((c) => !c.texto.trim())) return 'Todos los chequeos deben tener un texto';
  if (chequeos.some((c) => c.opciones.length === 0))
    return 'Cada chequeo necesita al menos una opción de respuesta';
  if (chequeos.some((c) => c.opciones.some((o) => !o.etiqueta.trim()))) {
    return 'Todas las opciones deben tener una etiqueta';
  }
  return null;
}

interface ChequeosTipoModalProps {
  tipo: TipoEquipoPersonalizado | null;
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}

/** Edita el checklist de recepción de un tipo de equipo (preguntas y opciones de respuesta). */
export function ChequeosTipoModal({ tipo, onCerrar, onGuardado }: ChequeosTipoModalProps) {
  const [chequeos, setChequeos] = useState<ChequeoEnEdicion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  useEffect(() => {
    if (!tipo) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    configuracionApi
      .listarChequeos(tipo.id)
      .then((data) => {
        if (vigente) setChequeos(data.map(conClave));
      })
      .catch((err) => {
        if (vigente) setError(getApiErrorMessage(err, 'No se pudieron cargar los chequeos'));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [tipo]);

  /** Aplica un cambio a un chequeo devolviendo copias nuevas, sin mutar el estado. */
  const modificar = (indice: number, cambio: (c: ChequeoEnEdicion) => ChequeoEnEdicion) =>
    setChequeos((previos) => previos.map((c, i) => (i === indice ? cambio(c) : c)));

  async function guardar() {
    if (!tipo) return;
    const problema = validar(chequeos);
    if (problema) {
      setError(problema);
      return;
    }
    const ok = await ejecutar(
      () =>
        configuracionApi.guardarChequeos(
          tipo.id,
          chequeos.map(({ texto, opciones }) => ({ texto, opciones }))
        ),
      'No se pudieron guardar los chequeos'
    );
    if (ok) onGuardado('Chequeos guardados');
  }

  return (
    <Modal show={!!tipo} onHide={onCerrar} size="lg" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Chequeos para {tipo?.nombre}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <AlertaError error={error} />
        {cargando ? (
          <Cargando />
        ) : (
          <>
            {chequeos.length === 0 && (
              <p className="text-muted text-center">No hay chequeos. Agregá uno para empezar.</p>
            )}
            {chequeos.map((chequeo, i) => (
              <Card key={chequeo.clave} className="mb-3">
                <Card.Body>
                  <Form.Group className="mb-3" controlId={`${chequeo.clave}-texto`}>
                    <Form.Label className="fw-bold">Pregunta {i + 1}</Form.Label>
                    <Form.Control
                      placeholder="Ej: ¿Enciende?"
                      value={chequeo.texto}
                      onChange={(e) => modificar(i, (c) => ({ ...c, texto: e.target.value }))}
                    />
                  </Form.Group>

                  <Form.Label className="fw-bold small">Opciones de respuesta</Form.Label>
                  {chequeo.opciones.map((opcion, j) => (
                    <div key={`${chequeo.clave}-${j}`} className="d-flex gap-2 mb-2">
                      <Form.Control
                        size="sm"
                        placeholder="Opción"
                        aria-label={`Opción ${j + 1}`}
                        value={opcion.etiqueta}
                        onChange={(e) =>
                          modificar(i, (c) => ({
                            ...c,
                            opciones: c.opciones.map((o, k) => (k === j ? { etiqueta: e.target.value } : o))
                          }))
                        }
                      />
                      {chequeo.opciones.length > 1 && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() =>
                            modificar(i, (c) => ({ ...c, opciones: c.opciones.filter((_, k) => k !== j) }))
                          }
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() =>
                      modificar(i, (c) => ({ ...c, opciones: [...c.opciones, { etiqueta: '' }] }))
                    }
                  >
                    + Opción
                  </Button>

                  <Button
                    variant="outline-danger"
                    size="sm"
                    className="w-100 mt-3"
                    onClick={() => setChequeos((previos) => previos.filter((_, k) => k !== i))}
                  >
                    Eliminar chequeo
                  </Button>
                </Card.Body>
              </Card>
            ))}
            <Button
              variant="outline-primary"
              className="w-100"
              onClick={() =>
                setChequeos((previos) => [
                  ...previos,
                  conClave({ texto: '', opciones: OPCIONES_POR_DEFECTO })
                ])
              }
            >
              + Agregar chequeo
            </Button>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={enCurso || cargando}>
          {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar chequeos'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
