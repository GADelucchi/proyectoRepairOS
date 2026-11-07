import type { KeyboardEvent, ReactNode } from 'react';
import { Card } from 'react-bootstrap';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { Tono } from '@/shared/constants/tonos';

interface TarjetaDatoProps {
  titulo: string;
  valor: ReactNode;
  /** Aclaración chica debajo del número. */
  detalle?: ReactNode;
  icono: LucideIcon;
  tono: Tono;
  /** Con una acción, la tarjeta entera se toca para ver lo que hay detrás del número. */
  onClick?: () => void;
  /** Qué abre el toque, debajo del número ("Ver cuáles"). */
  accion?: string;
}

/** Un número destacado con su ícono de color: los resúmenes del inicio y de reportes. */
export function TarjetaDato({
  titulo,
  valor,
  detalle,
  icono: Icono,
  tono,
  onClick,
  accion
}: TarjetaDatoProps) {
  const clickeable = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        className: 'h-100 tarjeta-clickeable',
        onClick,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }
      }
    : { className: 'h-100' };

  return (
    <Card body {...clickeable}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div className="text-muted small">{titulo}</div>
        <span className={`chip-icono chip-icono-sm tono-${tono}`}>
          <Icono size={16} aria-hidden="true" />
        </span>
      </div>
      <div className="dato-valor">{valor}</div>
      {detalle && <div className="text-muted small mt-1">{detalle}</div>}
      {onClick && accion && (
        <div className="small mt-1 tarjeta-accion">
          {accion} <ChevronRight size={14} aria-hidden="true" />
        </div>
      )}
    </Card>
  );
}
