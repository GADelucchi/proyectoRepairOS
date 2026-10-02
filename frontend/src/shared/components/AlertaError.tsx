import { Alert } from 'react-bootstrap';

interface AlertaErrorProps {
  error: string | null;
  onCerrar?: () => void;
  className?: string;
}

/** Muestra un error si lo hay. Va dentro de cada modal, no detrás del fondo oscuro. */
export function AlertaError({ error, onCerrar, className }: AlertaErrorProps) {
  if (!error) return null;
  return (
    <Alert variant="danger" dismissible={!!onCerrar} onClose={onCerrar} className={className}>
      {error}
    </Alert>
  );
}
