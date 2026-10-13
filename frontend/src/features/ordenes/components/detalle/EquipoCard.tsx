import { useState } from 'react';
import { Badge, Button, Card, Form, Stack } from 'react-bootstrap';
import { Link } from 'react-router';
import * as equiposApi from '@/features/equipos/api';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Equipo, Orden } from '@/shared/types';

interface EquipoCardProps {
  orden: Orden;
  onError: (mensaje: string) => void;
}

/**
 * Datos del equipo. Las credenciales se piden aparte y cada consulta queda auditada.
 * Con los datos a la vista se puede corregir la clave, por si la que dio el cliente no anda.
 */
export function EquipoCard({ orden, onError }: EquipoCardProps) {
  const [revelado, setRevelado] = useState<Equipo | null>(null);
  // Clave en edición; null cuando no se está cambiando.
  const [claveNueva, setClaveNueva] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(onError);
  const equipo = orden.equipo;

  async function alternarRevelado() {
    setClaveNueva(null);
    if (revelado) {
      setRevelado(null);
      return;
    }
    await ejecutar(
      async () => setRevelado(await equiposApi.obtenerEquipo(orden.equipoId, true)),
      'No se pudieron revelar los datos del equipo'
    );
  }

  async function guardarClave() {
    if (!revelado || claveNueva === null) return;
    const clave = claveNueva.trim() || null;
    const ok = await ejecutar(
      () => equiposApi.actualizarEquipo(orden.equipoId, { claveDesbloqueo: clave }),
      'No se pudo cambiar la clave'
    );
    if (ok) {
      setRevelado({ ...revelado, claveDesbloqueo: clave });
      setClaveNueva(null);
    }
  }

  return (
    <Card className="h-100">
      <Card.Header className="d-flex justify-content-between align-items-center">
        Equipo
        <Link to={`/equipos/${orden.equipoId}`} className="small">
          Ficha y etiqueta QR
        </Link>
      </Card.Header>
      <Card.Body>
        {equipo && (
          <>
            <div>
              <strong>
                {equipo.marca} {equipo.modelo}
              </strong>{' '}
              <Badge bg="secondary">{equipo.tipoEquipo?.nombre ?? 'Sin especificar'}</Badge>
            </div>
            <div>Color: {equipo.color ?? '-'}</div>
            <div>Nº de serie: {equipo.numeroSerie ?? '-'}</div>
            <hr className="my-2" />
            {revelado ? (
              <div className="small">
                {claveNueva !== null ? (
                  <Stack direction="horizontal" gap={2} className="mb-1">
                    <Form.Control
                      size="sm"
                      aria-label="Nueva clave de desbloqueo"
                      placeholder="Nueva clave (vacía para borrarla)"
                      value={claveNueva}
                      autoFocus
                      disabled={enCurso}
                      onChange={(e) => setClaveNueva(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') guardarClave();
                        if (e.key === 'Escape') setClaveNueva(null);
                      }}
                    />
                    <Button size="sm" onClick={guardarClave} disabled={enCurso}>
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => setClaveNueva(null)}
                      disabled={enCurso}
                    >
                      Cancelar
                    </Button>
                  </Stack>
                ) : (
                  <div>Clave de desbloqueo: {revelado.claveDesbloqueo ?? '-'}</div>
                )}
                <div>Usuario de cuenta: {revelado.cuentaUsuario ?? '-'}</div>
                <div>Contraseña de cuenta: {revelado.cuentaPassword ?? '-'}</div>
              </div>
            ) : (
              <div className="text-muted small">Datos sensibles ocultos</div>
            )}
            <Button size="sm" variant="link" className="ps-0" onClick={alternarRevelado} disabled={enCurso}>
              {revelado ? 'Ocultar' : 'Revelar datos sensibles'}
            </Button>
            {revelado && claveNueva === null && (
              <Button
                size="sm"
                variant="link"
                onClick={() => setClaveNueva(revelado.claveDesbloqueo ?? '')}
                disabled={enCurso}
              >
                Cambiar clave
              </Button>
            )}
            {!revelado && <div className="text-muted small">Cada consulta queda registrada.</div>}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
