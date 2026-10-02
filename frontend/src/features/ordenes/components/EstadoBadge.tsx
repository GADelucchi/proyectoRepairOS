import { Badge } from 'react-bootstrap';
import type { EstadoOrden } from '@/shared/types';
import { CLASE_BADGE_ESTADO, ETIQUETA_ESTADO } from '../estado-orden';

export function EstadoBadge({ estado, className = '' }: { estado: EstadoOrden; className?: string }) {
  return <Badge className={`${CLASE_BADGE_ESTADO[estado]} ${className}`}>{ETIQUETA_ESTADO[estado]}</Badge>;
}
