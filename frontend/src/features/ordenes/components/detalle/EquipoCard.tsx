import { useState } from 'react';
import { Badge, Button, Card, Form, Spinner, Stack } from 'react-bootstrap';
import { Link } from 'react-router';
import * as configuracionApi from '@/features/configuracion/api';
import * as equiposApi from '@/features/equipos/api';
import { EquipoFormFields } from '@/features/equipos/components/EquipoFormFields';
import { type EquipoFormData, equipoAFormulario, formularioAEquipo } from '@/features/equipos/equipo-form';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Equipo, TipoEquipoPersonalizado } from '@/shared/types';
import type { SeccionOrdenProps } from './tipos';

/**
 * Datos del equipo. Las credenciales se piden aparte y cada consulta queda auditada.
 * Con los datos a la vista se puede corregir la clave, por si la que dio el cliente no anda.
 *
 * El resto (serie, tipo, marca, modelo, color) se corrige acá mismo con "Editar",
 * sin ir a la pantalla de Equipos.
 */
export function EquipoCard({ orden, puedeEditar, onActualizada, onError }: SeccionOrdenProps) {
  const [revelado, setRevelado] = useState<Equipo | null>(null);
  // Clave en edición; null cuando no se está cambiando.
  const [claveNueva, setClaveNueva] = useState<string | null>(null);
  // Datos del equipo en edición; null cuando no se están editando.
  const [form, setForm] = useState<EquipoFormData | null>(null);
  const [tiposEquipo, setTiposEquipo] = useState<TipoEquipoPersonalizado[]>([]);
  const { enCurso, ejecutar } = useAccion(onError);
  const equipo = orden.equipo;

  async function abrirEdicion() {
    if (!equipo) return;
    await ejecutar(async () => {
      setTiposEquipo(await configuracionApi.listarTiposEquipo());
      setForm(equipoAFormulario(equipo));
    }, 'No se pudieron cargar los tipos de equipo');
  }

  async function guardarDatos() {
    if (!form) return;
    if (!form.numeroSerie.trim()) return onError('El número de serie no puede quedar vacío.');
    if (!form.tipoEquipoPersonalizadoId) return onError('Elegí el tipo de equipo.');
    // Las credenciales del formulario vienen enmascaradas: no se mandan para no pisarlas.
    const {
      claveDesbloqueo: _clave,
      cuentaUsuario: _usuario,
      cuentaPassword: _password,
      ...datos
    } = formularioAEquipo(form);
    const ok = await ejecutar(
      () => equiposApi.actualizarEquipo(orden.equipoId, datos),
      'No se pudieron guardar los datos del equipo'
    );
    if (ok) {
      setForm(null);
      onActualizada('Datos del equipo actualizados.');
    }
  }

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
      <Card.Header className="d-flex justify-content-between align-items-center gap-2">
        <span>Equipo</span>
        {form ? (
          <Stack direction="horizontal" gap={2}>
            <Button size="sm" variant="outline-secondary" onClick={() => setForm(null)} disabled={enCurso}>
              Cancelar
            </Button>
            <Button size="sm" onClick={guardarDatos} disabled={enCurso}>
              {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
            </Button>
          </Stack>
        ) : (
          <Stack direction="horizontal" gap={3}>
            <Link to={`/equipos/${orden.equipoId}`} className="small">
              Ficha y etiqueta QR
            </Link>
            {puedeEditar && equipo && (
              <Button size="sm" variant="outline-primary" onClick={abrirEdicion} disabled={enCurso}>
                Editar
              </Button>
            )}
          </Stack>
        )}
      </Card.Header>
      <Card.Body>
        {form && (
          <EquipoFormFields
            value={form}
            onChange={setForm}
            tiposEquipo={tiposEquipo}
            disabled={enCurso}
            serieObligatoria
            conCredenciales={false}
          />
        )}
        {equipo && !form && (
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
