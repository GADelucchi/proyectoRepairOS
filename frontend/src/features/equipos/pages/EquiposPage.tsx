import { useState } from 'react';
import { Alert, Badge, Button, Form, Modal } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import * as configuracionApi from '@/features/configuracion/api';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { TablaApilable } from '@/shared/components/TablaApilable';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Equipo } from '@/shared/types';
import { nombreCompleto } from '@/shared/utils/texto';
import { filaClickeable } from '@/shared/utils/filas';
import * as equiposApi from '../api';
import { EquipoModal } from '../components/EquipoModal';
import { EtiquetaQr } from '../components/EtiquetaQr';
import { describirEquipo } from '../equipo-form';

export function EquiposPage() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda);
  const {
    datos: equipos = [],
    cargando,
    error,
    setError,
    recargar
  } = useConsulta(
    () => equiposApi.listarEquipos({ search: busquedaDebounced || undefined }),
    [busquedaDebounced],
    'No se pudieron cargar los equipos',
    'equipos'
  );
  const { datos: tiposEquipo = [] } = useConsulta(
    configuracionApi.listarTiposEquipo,
    [],
    'No se pudieron cargar los tipos de equipo',
    'tiposEquipo'
  );
  const { ejecutar } = useAccion(setError);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Equipo | null>(null);
  const [revelados, setRevelados] = useState<Record<number, Equipo>>({});
  // Equipo cuya etiqueta QR se muestra: se abre sola al crear uno nuevo.
  const [conQr, setConQr] = useState<{ equipo: Equipo; recienCreado: boolean } | null>(null);

  function abrirNuevo() {
    setEditando(null);
    setModalAbierto(true);
  }

  /** Para editar hacen falta las credenciales en claro, así que se piden reveladas. */
  async function abrirEdicion(equipo: Equipo) {
    await ejecutar(async () => {
      setEditando(await equiposApi.obtenerEquipo(equipo.id, true));
      setModalAbierto(true);
    }, 'No se pudo cargar el equipo');
  }

  async function eliminar(equipo: Equipo) {
    if (!window.confirm(`¿Eliminar el equipo ${describirEquipo(equipo)}?`)) return;
    if (await ejecutar(() => equiposApi.eliminarEquipo(equipo.id), 'No se pudo eliminar el equipo'))
      recargar();
  }

  async function alternarRevelado(equipo: Equipo) {
    if (revelados[equipo.id]) {
      setRevelados(({ [equipo.id]: _, ...resto }) => resto);
      return;
    }
    await ejecutar(async () => {
      const completo = await equiposApi.obtenerEquipo(equipo.id, true);
      setRevelados((previos) => ({ ...previos, [equipo.id]: completo }));
    }, 'No se pudieron revelar los datos');
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3>Equipos</h3>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" to="/escanear">
            Escanear QR
          </Link>
          <Button onClick={abrirNuevo}>+ Nuevo equipo</Button>
        </div>
      </div>

      <Form.Control
        className="mb-3"
        placeholder="Buscar por número de serie, marca o modelo..."
        aria-label="Buscar equipos"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <AlertaError error={error} onCerrar={() => setError(null)} />

      {cargando ? (
        <Cargando />
      ) : (
        <TablaApilable striped bordered hover responsive>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Marca / Modelo</th>
              <th>Color</th>
              <th>Nº de serie</th>
              <th>Dueño</th>
              <th>Datos sensibles</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((eq) => {
              const revelado = revelados[eq.id];
              return (
                <tr key={eq.id} {...filaClickeable(() => navigate(`/equipos/${eq.id}`))}>
                  <td>
                    <Badge bg="secondary">{eq.tipoEquipo?.nombre ?? 'Sin especificar'}</Badge>
                  </td>
                  <td className="font-mono">
                    {eq.marca ?? '-'} {eq.modelo ?? ''}
                  </td>
                  <td>{eq.color ?? '-'}</td>
                  <td className="font-mono">{eq.numeroSerie ?? '-'}</td>
                  <td>{nombreCompleto(eq.cliente) || '-'}</td>
                  <td>
                    {revelado ? (
                      <div className="small">
                        <div>Clave: {revelado.claveDesbloqueo ?? '-'}</div>
                        <div>Usuario: {revelado.cuentaUsuario ?? '-'}</div>
                        <div>Contraseña: {revelado.cuentaPassword ?? '-'}</div>
                      </div>
                    ) : (
                      <span className="text-muted">••••••••</span>
                    )}
                    <Button size="sm" variant="link" onClick={() => alternarRevelado(eq)}>
                      {revelado ? 'Ocultar' : 'Revelar'}
                    </Button>
                  </td>
                  <td className="text-nowrap">
                    <Link className="btn btn-sm btn-outline-secondary me-2" to={`/equipos/${eq.id}`}>
                      Ver
                    </Link>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-2"
                      onClick={() => setConQr({ equipo: eq, recienCreado: false })}
                    >
                      QR
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-2"
                      onClick={() => abrirEdicion(eq)}
                    >
                      Editar
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => eliminar(eq)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              );
            })}
            {equipos.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted">
                  {busqueda ? 'Ningún equipo coincide con la búsqueda' : 'No hay equipos cargados'}
                </td>
              </tr>
            )}
          </tbody>
        </TablaApilable>
      )}

      <EquipoModal
        show={modalAbierto}
        equipo={editando}
        tiposEquipo={tiposEquipo}
        onCerrar={() => setModalAbierto(false)}
        onEditarExistente={abrirEdicion}
        onGuardado={(guardado) => {
          const eraNuevo = !editando;
          setModalAbierto(false);
          setRevelados({});
          recargar();
          if (eraNuevo) setConQr({ equipo: guardado, recienCreado: true });
        }}
      />

      <Modal show={conQr !== null} onHide={() => setConQr(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Etiqueta QR</Modal.Title>
        </Modal.Header>
        {conQr && (
          <Modal.Body>
            {conQr.recienCreado && (
              <Alert variant="success" className="py-2">
                Equipo guardado. Imprimí la etiqueta y pegala atrás del equipo.
              </Alert>
            )}
            <div className="text-center mb-3">
              <div className="fw-semibold">{describirEquipo({ ...conQr.equipo, numeroSerie: null })}</div>
              <div className="font-mono small">S/N {conQr.equipo.numeroSerie ?? '-'}</div>
            </div>
            <EtiquetaQr equipo={conQr.equipo} onError={setError} tamano={200} />
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConQr(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
