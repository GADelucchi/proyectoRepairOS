import { useState } from 'react';
import { Badge, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router';
import * as equiposApi from '@/features/equipos/api';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Equipo, Orden } from '@/shared/types';

interface EquipoCardProps {
  orden: Orden;
  onError: (mensaje: string) => void;
}

/** Datos del equipo. Las credenciales se piden aparte y cada consulta queda auditada. */
export function EquipoCard({ orden, onError }: EquipoCardProps) {
  const [revelado, setRevelado] = useState<Equipo | null>(null);
  const { enCurso, ejecutar } = useAccion(onError);
  const equipo = orden.equipo;

  async function alternarRevelado() {
    if (revelado) {
      setRevelado(null);
      return;
    }
    await ejecutar(
      async () => setRevelado(await equiposApi.obtenerEquipo(orden.equipoId, true)),
      'No se pudieron revelar los datos del equipo'
    );
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
                <div>Clave de desbloqueo: {revelado.claveDesbloqueo ?? '-'}</div>
                <div>Usuario de cuenta: {revelado.cuentaUsuario ?? '-'}</div>
                <div>Contraseña de cuenta: {revelado.cuentaPassword ?? '-'}</div>
              </div>
            ) : (
              <div className="text-muted small">Datos sensibles ocultos</div>
            )}
            <Button size="sm" variant="link" className="ps-0" onClick={alternarRevelado} disabled={enCurso}>
              {revelado ? 'Ocultar' : 'Revelar datos sensibles'}
            </Button>
            {!revelado && <div className="text-muted small">Cada consulta queda registrada.</div>}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
