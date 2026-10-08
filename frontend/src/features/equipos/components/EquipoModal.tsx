import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { Link } from 'react-router';
import * as clientesApi from '@/features/clientes/api';
import { AlertaError } from '@/shared/components/AlertaError';
import { BuscadorConSugerencias } from '@/shared/components/BuscadorConSugerencias';
import { useAccion } from '@/shared/hooks/useAccion';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import type { Cliente, Equipo, TipoEquipoPersonalizado } from '@/shared/types';
import { nombreCompleto } from '@/shared/utils/texto';
import * as equiposApi from '../api';
import {
  describirEquipo,
  EQUIPO_FORM_VACIO,
  EquipoFormData,
  equipoAFormulario,
  formularioAEquipo
} from '../equipo-form';
import { useBusquedaPorSerie } from '../hooks/useBusquedaPorSerie';
import { EquipoFormFields } from './EquipoFormFields';

interface EquipoModalProps {
  show: boolean;
  /** Equipo a editar, ya con las credenciales reveladas. null para uno nuevo. */
  equipo: Equipo | null;
  tiposEquipo: TipoEquipoPersonalizado[];
  onCerrar: () => void;
  /** El número de serie de un alta ya existía: se pasa a editar ese equipo. */
  onEditarExistente: (equipo: Equipo) => void;
  /** Recibe el equipo guardado (el nuevo, al crear: para ofrecer su etiqueta QR). */
  onGuardado: (equipo: Equipo) => void;
}

export function EquipoModal({
  show,
  equipo,
  tiposEquipo,
  onCerrar,
  onEditarExistente,
  onGuardado
}: EquipoModalProps) {
  const [form, setForm] = useState<EquipoFormData>(EQUIPO_FORM_VACIO);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [textoCliente, setTextoCliente] = useState('');
  const [error, setError] = useState<string | null>(null);
  const guardado = useAccion(setError);
  const generacion = useAccion(setError);

  const sugerencias = useBusqueda(textoCliente, clientesApi.listarClientes, clienteId === null);

  // Al dar de alta: si la serie ya está cargada, se ofrece ir a ese equipo en vez de duplicarlo.
  const [existente, setExistente] = useState<Equipo | null>(null);
  const porSerie = useBusquedaPorSerie(useCallback((encontrado: Equipo) => setExistente(encontrado), []));

  useEffect(() => {
    if (!show) return;
    setForm(equipo ? equipoAFormulario(equipo) : EQUIPO_FORM_VACIO);
    setClienteId(equipo?.clienteId ?? null);
    setTextoCliente(nombreCompleto(equipo?.cliente));
    setError(null);
    setExistente(null);
  }, [show, equipo]);

  function elegirCliente(cliente: Cliente) {
    setClienteId(cliente.id);
    setTextoCliente(nombreCompleto(cliente));
  }

  async function generarSerie() {
    await generacion.ejecutar(async () => {
      const numeroSerie = await equiposApi.generarNumeroSerie();
      setForm((f) => ({ ...f, numeroSerie }));
    }, 'No se pudo generar el número de serie');
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!clienteId) return setError('Elegí el cliente dueño del equipo.');
    if (!form.tipoEquipoPersonalizadoId) return setError('Elegí el tipo de equipo.');
    if (!form.numeroSerie.trim())
      return setError('El número de serie es obligatorio: cargalo o tocá Generar.');

    const datos = { ...formularioAEquipo(form), clienteId };
    let resultado: Equipo | undefined;
    const ok = await guardado.ejecutar(async () => {
      resultado = equipo
        ? await equiposApi.actualizarEquipo(equipo.id, datos)
        : await equiposApi.crearEquipo(datos);
    }, 'No se pudo guardar el equipo');
    if (ok && resultado) onGuardado(resultado);
  }

  return (
    <Modal show={show} onHide={onCerrar} size="lg">
      <Form onSubmit={guardar}>
        <Modal.Header closeButton>
          <Modal.Title>{equipo ? 'Editar equipo' : 'Nuevo equipo'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AlertaError error={error} />
          <Form.Group className="mb-3">
            <Form.Label>Cliente dueño del equipo</Form.Label>
            <BuscadorConSugerencias
              texto={textoCliente}
              onTextoChange={(texto) => {
                setTextoCliente(texto);
                setClienteId(null);
              }}
              sugerencias={sugerencias}
              claveDe={(c) => c.id}
              mostrar={(c) => `${nombreCompleto(c)}${c.dniCuit ? ` (${c.dniCuit})` : ''}`}
              onElegir={elegirCliente}
              placeholder="Buscar cliente por nombre, apellido o DNI..."
            />
            {clienteId && <div className="text-success small mt-1">Cliente seleccionado ✓</div>}
          </Form.Group>

          {existente && (
            <Alert variant="info" className="py-2">
              Ese número de serie ya está cargado: <strong>{describirEquipo(existente)}</strong>
              {existente.cliente && <> de {nombreCompleto(existente.cliente)}</>}.
              <div className="d-flex gap-2 mt-2">
                <Link className="btn btn-sm btn-outline-secondary" to={`/equipos/${existente.id}`}>
                  Ver ficha
                </Link>
                <Button size="sm" onClick={() => onEditarExistente(existente)}>
                  Editar ese equipo
                </Button>
              </div>
            </Alert>
          )}
          <EquipoFormFields
            value={form}
            onChange={(nuevo) => {
              if (nuevo.numeroSerie !== form.numeroSerie) setExistente(null);
              setForm(nuevo);
            }}
            onSerieCompleta={equipo ? undefined : porSerie.buscar}
            buscandoSerie={porSerie.buscando}
            tiposEquipo={tiposEquipo}
            disabled={guardado.enCurso}
            serieObligatoria
            onGenerarSerie={equipo ? undefined : generarSerie}
            generandoSerie={generacion.enCurso}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardado.enCurso}>
            {guardado.enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
