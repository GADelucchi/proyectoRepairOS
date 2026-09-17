import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Modal, Spinner, Table, Toast, ToastContainer } from 'react-bootstrap';
import * as configuracionApi from '../api/configuracion';
import { TipoEquipoPersonalizado, ChequeoPersonalizado } from '../types';
import { getApiErrorMessage } from '../api/client';

/**
 * Los chequeos en edición llevan una clave propia y estable: sin ella React
 * reutiliza el input equivocado al borrar un elemento del medio de la lista.
 */
interface ChequeoEnEdicion extends ChequeoPersonalizado {
  clave: string;
}

let contadorClaves = 0;
const nuevaClave = () => `chequeo-${++contadorClaves}`;

const conClave = (chequeo: ChequeoPersonalizado): ChequeoEnEdicion => ({
  ...chequeo,
  opciones: chequeo.opciones.map((o) => ({ ...o })),
  clave: nuevaClave()
});

export function ConfiguracionPage() {
  const [tipos, setTipos] = useState<TipoEquipoPersonalizado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Modal para nuevo tipo de equipo
  const [modalNuevoTipo, setModalNuevoTipo] = useState(false);
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('');
  const [guardandoTipo, setGuardandoTipo] = useState(false);

  // Modal para editar tipo
  const [tipoEditando, setTipoEditando] = useState<TipoEquipoPersonalizado | null>(null);
  const [tipoEditandoNombre, setTipoEditandoNombre] = useState('');
  const [modalEditarTipo, setModalEditarTipo] = useState(false);

  // Modal para chequeos
  const [tipoParaChequeos, setTipoParaChequeos] = useState<TipoEquipoPersonalizado | null>(null);
  const [chequeos, setChequeos] = useState<ChequeoEnEdicion[]>([]);
  const [cargandoChequeos, setCargandoChequeos] = useState(false);
  const [modalChequeos, setModalChequeos] = useState(false);
  const [guardandoChequeos, setGuardandoChequeos] = useState(false);

  async function cargarTipos() {
    setCargando(true);
    setError(null);
    try {
      const data = await configuracionApi.listarTiposEquipo();
      setTipos(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los tipos de equipo'));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTipos();
  }, []);

  async function handleAgregarTipo(e: FormEvent) {
    e.preventDefault();
    if (!nuevoTipoNombre.trim()) {
      setError('El nombre del tipo de equipo es requerido');
      return;
    }

    setGuardandoTipo(true);
    setError(null);
    try {
      const nuevoTipo = await configuracionApi.crearTipoEquipo(nuevoTipoNombre);
      setTipos([...tipos, nuevoTipo]);
      setNuevoTipoNombre('');
      setModalNuevoTipo(false);
      setExito('Tipo de equipo creado exitosamente');
      setTimeout(() => setExito(null), 3000);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo crear el tipo de equipo'));
    } finally {
      setGuardandoTipo(false);
    }
  }

  async function handleEditarTipo(e: FormEvent) {
    e.preventDefault();
    if (!tipoEditando) return;
    if (!tipoEditandoNombre.trim()) {
      setError('El nombre del tipo de equipo es requerido');
      return;
    }

    setGuardandoTipo(true);
    setError(null);
    try {
      const actualizado = await configuracionApi.actualizarTipoEquipo(tipoEditando.id, tipoEditandoNombre);
      setTipos(tipos.map((t) => (t.id === tipoEditando.id ? actualizado : t)));
      setTipoEditando(null);
      setModalEditarTipo(false);
      setExito('Tipo de equipo actualizado exitosamente');
      setTimeout(() => setExito(null), 3000);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar el tipo de equipo'));
    } finally {
      setGuardandoTipo(false);
    }
  }

  async function handleEliminarTipo(id: number) {
    if (!confirm('¿Estás seguro de que deseas eliminar este tipo de equipo?')) return;

    setError(null);
    try {
      await configuracionApi.eliminarTipoEquipo(id);
      setTipos(tipos.filter((t) => t.id !== id));
      setExito('Tipo de equipo eliminado exitosamente');
      setTimeout(() => setExito(null), 3000);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar el tipo de equipo'));
    }
  }

  async function abrirChequeos(tipo: TipoEquipoPersonalizado) {
    setTipoParaChequeos(tipo);
    setCargandoChequeos(true);
    setError(null);
    try {
      const data = await configuracionApi.listarChequeos(tipo.id);
      setChequeos(data.map(conClave));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los chequeos'));
    } finally {
      setCargandoChequeos(false);
    }
    setModalChequeos(true);
  }

  function agregarChequeo() {
    setChequeos((prev) => [
      ...prev,
      conClave({
        texto: '',
        opciones: [{ etiqueta: 'Sí' }, { etiqueta: 'No' }, { etiqueta: 'Sin revisar' }]
      })
    ]);
  }

  function eliminarChequeo(index: number) {
    setChequeos((prev) => prev.filter((_, i) => i !== index));
  }

  /** Aplica un cambio a un chequeo devolviendo copias nuevas, sin mutar el estado. */
  function modificarChequeo(index: number, cambio: (c: ChequeoEnEdicion) => ChequeoEnEdicion) {
    setChequeos((prev) => prev.map((c, i) => (i === index ? cambio(c) : c)));
  }

  function actualizarTextoChequeo(index: number, texto: string) {
    modificarChequeo(index, (c) => ({ ...c, texto }));
  }

  function actualizarOpcionChequeo(chequeIndex: number, opcionIndex: number, etiqueta: string) {
    modificarChequeo(chequeIndex, (c) => ({
      ...c,
      opciones: c.opciones.map((o, i) => (i === opcionIndex ? { ...o, etiqueta } : o))
    }));
  }

  function agregarOpcionChequeo(chequeIndex: number) {
    modificarChequeo(chequeIndex, (c) => ({ ...c, opciones: [...c.opciones, { etiqueta: '' }] }));
  }

  function eliminarOpcionChequeo(chequeIndex: number, opcionIndex: number) {
    modificarChequeo(chequeIndex, (c) => ({
      ...c,
      opciones: c.opciones.filter((_, i) => i !== opcionIndex)
    }));
  }

  async function handleGuardarChequeos() {
    if (!tipoParaChequeos) return;

    if (chequeos.some((c) => !c.texto.trim())) {
      setError('Todos los chequeos deben tener un texto');
      return;
    }

    if (chequeos.some((c) => c.opciones.some((o) => !o.etiqueta.trim()))) {
      setError('Todas las opciones deben tener una etiqueta');
      return;
    }

    if (chequeos.some((c) => c.opciones.length === 0)) {
      setError('Cada chequeo necesita al menos una opción de respuesta');
      return;
    }

    setGuardandoChequeos(true);
    setError(null);
    try {
      await configuracionApi.guardarChequeos(
        tipoParaChequeos.id,
        chequeos.map(({ clave: _clave, ...chequeo }) => chequeo)
      );
      setModalChequeos(false);
      setTipoParaChequeos(null);
      setChequeos([]);
      setExito('Chequeos guardados exitosamente');
      setTimeout(() => setExito(null), 3000);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron guardar los chequeos'));
    } finally {
      setGuardandoChequeos(false);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Configuración</h3>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      <ToastContainer position="top-end" className="p-3">
        {exito && (
          <Toast show onClose={() => setExito(null)} delay={3000} autohide bg="success">
            <Toast.Body className="text-white">{exito}</Toast.Body>
          </Toast>
        )}
      </ToastContainer>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Tipos de equipo personalizados</span>
          <Button variant="primary" size="sm" onClick={() => setModalNuevoTipo(true)}>
            + Agregar tipo de equipo
          </Button>
        </Card.Header>
        <Card.Body>
          {cargando ? (
            <Spinner animation="border" />
          ) : tipos.length === 0 ? (
            <p className="text-muted text-center mb-0">
              No hay tipos de equipo creados. Crea uno para empezar.
            </p>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th style={{ width: 280 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((tipo) => (
                  <tr key={tipo.id}>
                    <td>{tipo.nombre}</td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={() => abrirChequeos(tipo)}
                      >
                        Configurar chequeos
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="me-2"
                        onClick={() => {
                          setTipoEditando(tipo);
                          setTipoEditandoNombre(tipo.nombre);
                          setModalEditarTipo(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button variant="outline-danger" size="sm" onClick={() => handleEliminarTipo(tipo.id)}>
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Modal nuevo tipo de equipo */}
      <Modal show={modalNuevoTipo} onHide={() => setModalNuevoTipo(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Agregar tipo de equipo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAgregarTipo}>
            <Form.Group className="mb-3">
              <Form.Label>Nombre del tipo de equipo</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ej: iPhone, Samsung Galaxy, etc."
                value={nuevoTipoNombre}
                onChange={(e) => setNuevoTipoNombre(e.target.value)}
                autoFocus
              />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={guardandoTipo} className="w-100">
              {guardandoTipo ? <Spinner animation="border" size="sm" className="me-2" /> : null}
              Agregar
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal editar tipo de equipo */}
      <Modal show={modalEditarTipo} onHide={() => setModalEditarTipo(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Editar tipo de equipo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleEditarTipo}>
            <Form.Group className="mb-3">
              <Form.Label>Nombre del tipo de equipo</Form.Label>
              <Form.Control
                type="text"
                value={tipoEditandoNombre}
                onChange={(e) => setTipoEditandoNombre(e.target.value)}
                autoFocus
              />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={guardandoTipo} className="w-100">
              {guardandoTipo ? <Spinner animation="border" size="sm" className="me-2" /> : null}
              Guardar cambios
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal chequeos */}
      <Modal show={modalChequeos} onHide={() => setModalChequeos(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Chequeos para {tipoParaChequeos?.nombre}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {cargandoChequeos ? (
            <Spinner animation="border" />
          ) : (
            <div>
              {chequeos.length === 0 ? (
                <p className="text-muted text-center">No hay chequeos. Agrega uno para empezar.</p>
              ) : (
                chequeos.map((chequeo, chequeIdx) => (
                  <Card key={chequeo.clave} className="mb-3">
                    <Card.Body>
                      <div className="mb-3">
                        <Form.Group>
                          <Form.Label className="fw-bold">Pregunta {chequeIdx + 1}</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Ej: ¿Enciende?"
                            value={chequeo.texto}
                            onChange={(e) => actualizarTextoChequeo(chequeIdx, e.target.value)}
                          />
                        </Form.Group>
                      </div>

                      <div className="mb-2">
                        <Form.Label className="fw-bold small">Opciones de respuesta</Form.Label>
                        {chequeo.opciones.map((opcion, opcionIdx) => (
                          <div key={`${chequeo.clave}-${opcionIdx}`} className="d-flex gap-2 mb-2">
                            <Form.Control
                              type="text"
                              placeholder="Opción"
                              value={opcion.etiqueta}
                              onChange={(e) => actualizarOpcionChequeo(chequeIdx, opcionIdx, e.target.value)}
                              size="sm"
                            />
                            {chequeo.opciones.length > 1 && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => eliminarOpcionChequeo(chequeIdx, opcionIdx)}
                              >
                                Eliminar
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => agregarOpcionChequeo(chequeIdx)}
                        >
                          + Opción
                        </Button>
                      </div>

                      <Button
                        variant="outline-danger"
                        size="sm"
                        className="w-100 mt-2"
                        onClick={() => eliminarChequeo(chequeIdx)}
                      >
                        Eliminar chequeo
                      </Button>
                    </Card.Body>
                  </Card>
                ))
              )}

              <Button variant="outline-primary" className="w-100 mb-3" onClick={agregarChequeo}>
                + Agregar chequeo
              </Button>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalChequeos(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleGuardarChequeos}
            disabled={guardandoChequeos || cargandoChequeos}
          >
            {guardandoChequeos ? <Spinner animation="border" size="sm" className="me-2" /> : null}
            Guardar chequeos
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
