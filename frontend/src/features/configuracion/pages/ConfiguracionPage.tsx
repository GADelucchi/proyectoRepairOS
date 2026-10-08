import { useState } from 'react';
import { Button, Card, Table, Toast, ToastContainer } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { TipoEquipoPersonalizado } from '@/shared/types';
import * as configuracionApi from '../api';
import { ChequeosTipoModal } from '../components/ChequeosTipoModal';
import { DatosTallerCard } from '../components/DatosTallerCard';
import { PortalClientesCard } from '../components/PortalClientesCard';
import { NombreTipoModal } from '../components/NombreTipoModal';

/** Datos del taller (admin), tipos de equipo de la sucursal y el checklist de recepción de cada uno. */
export function ConfiguracionPage() {
  const { esAdmin } = useAuth();
  const {
    datos: tipos = [],
    cargando,
    error,
    setError,
    recargar
  } = useConsulta(configuracionApi.listarTiposEquipo, [], 'No se pudieron cargar los tipos de equipo');
  const { ejecutar } = useAccion(setError);
  const [exito, setExito] = useState<string | null>(null);

  // `undefined` = modal cerrado; `null` = alta de un tipo nuevo.
  const [tipoNombre, setTipoNombre] = useState<TipoEquipoPersonalizado | null | undefined>(undefined);
  const [tipoChequeos, setTipoChequeos] = useState<TipoEquipoPersonalizado | null>(null);

  function listo(mensaje: string) {
    setTipoNombre(undefined);
    setTipoChequeos(null);
    setExito(mensaje);
    recargar();
  }

  async function eliminar(tipo: TipoEquipoPersonalizado) {
    if (!window.confirm(`¿Eliminar el tipo "${tipo.nombre}"?`)) return;
    if (
      await ejecutar(
        () => configuracionApi.eliminarTipoEquipo(tipo.id),
        'No se pudo eliminar el tipo de equipo'
      )
    ) {
      listo('Tipo de equipo eliminado');
    }
  }

  return (
    <div>
      <h3 className="mb-3">Configuración</h3>

      <AlertaError error={error} onCerrar={() => setError(null)} />

      <ToastContainer position="top-end" className="p-3">
        {exito && (
          <Toast show onClose={() => setExito(null)} delay={3000} autohide bg="success">
            <Toast.Body className="text-white">{exito}</Toast.Body>
          </Toast>
        )}
      </ToastContainer>

      {esAdmin && <DatosTallerCard onError={setError} onGuardado={setExito} />}
      <PortalClientesCard />

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Tipos de equipo</span>
          <Button size="sm" onClick={() => setTipoNombre(null)}>
            + Agregar tipo de equipo
          </Button>
        </Card.Header>
        <Card.Body>
          {cargando ? (
            <Cargando />
          ) : tipos.length === 0 ? (
            <p className="text-muted text-center mb-0">
              No hay tipos de equipo creados. Creá uno para empezar.
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
                    <td className="text-nowrap">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={() => setTipoChequeos(tipo)}
                      >
                        Configurar chequeos
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="me-2"
                        onClick={() => setTipoNombre(tipo)}
                      >
                        Editar
                      </Button>
                      <Button variant="outline-danger" size="sm" onClick={() => eliminar(tipo)}>
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

      <NombreTipoModal
        show={tipoNombre !== undefined}
        tipo={tipoNombre ?? null}
        onCerrar={() => setTipoNombre(undefined)}
        onGuardado={listo}
      />
      <ChequeosTipoModal tipo={tipoChequeos} onCerrar={() => setTipoChequeos(null)} onGuardado={listo} />
    </div>
  );
}
