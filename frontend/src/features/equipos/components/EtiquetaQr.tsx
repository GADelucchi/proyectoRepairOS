import { useEffect, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useAccion } from '@/shared/hooks/useAccion';
import type { Equipo } from '@/shared/types';
import { imprimirEtiqueta, qrComoImagen, urlDeEquipo } from '../qr';

interface EtiquetaQrProps {
  equipo: Equipo;
  onError: (mensaje: string) => void;
  /** Lado del QR en pantalla, en px. */
  tamano?: number;
}

/** QR del equipo con el botón para imprimir la etiqueta. */
export function EtiquetaQr({ equipo, onError, tamano = 160 }: EtiquetaQrProps) {
  const [imagen, setImagen] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const { enCurso, ejecutar } = useAccion(onError);

  useEffect(() => {
    let vigente = true;
    setFallo(false);
    qrComoImagen(urlDeEquipo(equipo.id))
      .then((src) => vigente && setImagen(src))
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [equipo.id]);

  return (
    <div className="text-center">
      {imagen ? (
        <img
          src={imagen}
          width={tamano}
          height={tamano}
          alt={`QR del equipo ${equipo.numeroSerie ?? equipo.id}`}
          className="bg-white p-1 rounded"
        />
      ) : (
        <div style={{ height: tamano }} className="d-flex align-items-center justify-content-center">
          {fallo ? (
            <span className="text-danger small">No se pudo generar el QR</span>
          ) : (
            <Spinner animation="border" size="sm" />
          )}
        </div>
      )}
      <div className="mt-2">
        <Button
          size="sm"
          onClick={() => ejecutar(() => imprimirEtiqueta(equipo), 'No se pudo imprimir la etiqueta')}
          disabled={enCurso || !imagen}
        >
          {enCurso ? <Spinner size="sm" animation="border" /> : 'Imprimir etiqueta'}
        </Button>
      </div>
      <div className="text-muted small mt-1">Etiqueta de 50 × 30 mm para pegar en el equipo.</div>
    </div>
  );
}
