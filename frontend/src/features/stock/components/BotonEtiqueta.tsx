import { Button, ButtonGroup, Dropdown, Spinner } from 'react-bootstrap';
import { Printer } from 'lucide-react';
import { useAccion } from '@/shared/hooks/useAccion';
import type { EquipoStock } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { imprimirEtiquetaStock } from '../etiqueta';

interface BotonEtiquetaProps {
  equipo: EquipoStock;
  onError: (mensaje: string) => void;
  size?: 'sm';
  variant?: string;
}

/**
 * Imprime la etiqueta de 50 × 30 mm del equipo. Por defecto sin precio (cambia
 * seguido y obligaría a reimprimir); con precio, desde el desplegable.
 */
export function BotonEtiqueta({ equipo, onError, size, variant = 'outline-secondary' }: BotonEtiquetaProps) {
  const { enCurso, ejecutar } = useAccion(onError);
  const imprimir = (conPrecio: boolean) =>
    ejecutar(() => imprimirEtiquetaStock(equipo, { conPrecio }), 'No se pudo imprimir la etiqueta');
  const precio =
    equipo.precio != null && equipo.monedaPrecio ? formatearMonto(equipo.precio, equipo.monedaPrecio) : null;

  const boton = (
    <Button
      size={size}
      variant={variant}
      onClick={() => imprimir(false)}
      disabled={enCurso}
      title="Etiqueta de 50 × 30 mm para impresora térmica"
    >
      {enCurso ? <Spinner size="sm" animation="border" /> : <Printer size={16} className="me-1" />}
      Imprimir etiqueta
    </Button>
  );
  if (!precio) return boton;

  return (
    <Dropdown as={ButtonGroup}>
      {boton}
      <Dropdown.Toggle
        split
        size={size}
        variant={variant}
        disabled={enCurso}
        aria-label="Más opciones de etiqueta"
      />
      <Dropdown.Menu align="end">
        <Dropdown.Item onClick={() => imprimir(true)}>Con precio ({precio})</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
