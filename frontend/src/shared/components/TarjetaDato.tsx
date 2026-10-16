import type { ReactNode } from 'react';
import { Card } from 'react-bootstrap';
import type { LucideIcon } from 'lucide-react';
import type { Tono } from '@/shared/constants/tonos';

interface TarjetaDatoProps {
  titulo: string;
  valor: ReactNode;
  /** Aclaración chica debajo del número. */
  detalle?: ReactNode;
  icono: LucideIcon;
  tono: Tono;
}

/** Un número destacado con su ícono de color: los resúmenes del inicio y de reportes. */
export function TarjetaDato({ titulo, valor, detalle, icono: Icono, tono }: TarjetaDatoProps) {
  return (
    <Card body className="h-100">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div className="text-muted small">{titulo}</div>
        <span className={`chip-icono chip-icono-sm tono-${tono}`}>
          <Icono size={16} aria-hidden="true" />
        </span>
      </div>
      <div className="dato-valor">{valor}</div>
      {detalle && <div className="text-muted small mt-1">{detalle}</div>}
    </Card>
  );
}
