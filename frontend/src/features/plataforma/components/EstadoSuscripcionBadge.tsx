import { Badge } from 'react-bootstrap';
import type { EstadoSuscripcion, Suscripcion } from '@/shared/types';

const ETIQUETA: Record<EstadoSuscripcion, string> = {
  prueba: 'Prueba',
  activa: 'Activa',
  vencida: 'Vencida',
  cancelada: 'Cancelada'
};

const COLOR: Record<EstadoSuscripcion, string> = {
  prueba: 'info',
  activa: 'success',
  vencida: 'danger',
  cancelada: 'secondary'
};

/** Estado de la suscripción con los días que le quedan. */
export function EstadoSuscripcionBadge({ suscripcion }: { suscripcion: Suscripcion | null }) {
  if (!suscripcion) return <Badge bg="dark">Sin suscripción</Badge>;
  const { estado, diasRestantes, bloqueada } = suscripcion;
  const pocosDias = !bloqueada && diasRestantes !== null && diasRestantes <= 7;
  return (
    <span className="text-nowrap">
      <Badge bg={COLOR[estado]}>{ETIQUETA[estado]}</Badge>
      {diasRestantes !== null && !bloqueada && (
        <span className={`small ms-1 ${pocosDias ? 'text-warning fw-semibold' : 'text-muted'}`}>
          {diasRestantes === 0 ? 'último día' : `${diasRestantes} d`}
        </span>
      )}
      {estado === 'activa' && diasRestantes === null && (
        <span className="small ms-1 text-muted">sin vencimiento</span>
      )}
    </span>
  );
}
