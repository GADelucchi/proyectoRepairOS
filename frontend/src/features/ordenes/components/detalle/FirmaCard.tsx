import { Card, Image, Spinner } from 'react-bootstrap';
import { useAccion } from '@/shared/hooks/useAccion';
import { formatearFechaHora } from '@/shared/utils/fechas';
import * as ordenesApi from '../../api';
import { useFirmaUrl } from '../../hooks/useFirmaUrl';
import { SignaturePad } from '../SignaturePad';
import type { SeccionOrdenProps } from './tipos';

/** Firma del cliente en la recepción. Una vez guardada no se reemplaza. */
export function FirmaCard({ orden, puedeEditar, onActualizada, onError }: SeccionOrdenProps) {
  const firmaUrl = useFirmaUrl(orden.id, orden.firmaClienteAt);
  const { enCurso, ejecutar } = useAccion(onError);

  async function guardar(dataUrl: string) {
    if (await ejecutar(() => ordenesApi.guardarFirma(orden.id, dataUrl), 'No se pudo guardar la firma')) {
      onActualizada('Firma guardada correctamente.');
    }
  }

  return (
    <Card className="h-100">
      <Card.Header>Firma del cliente</Card.Header>
      <Card.Body>
        {orden.firmaClienteAt ? (
          <>
            {firmaUrl ? (
              <Image src={firmaUrl} alt="Firma del cliente" thumbnail style={{ maxWidth: 300 }} />
            ) : (
              <Spinner size="sm" animation="border" />
            )}
            <div className="text-muted small mt-2">
              Firmada en la recepción el {formatearFechaHora(orden.firmaClienteAt)}.
            </div>
          </>
        ) : (
          <SignaturePad onGuardar={guardar} disabled={enCurso || !puedeEditar} />
        )}
      </Card.Body>
    </Card>
  );
}
