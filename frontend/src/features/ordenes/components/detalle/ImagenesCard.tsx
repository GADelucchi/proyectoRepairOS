import { useState } from 'react';
import { Button, Card, Col, Image, Row, Spinner } from 'react-bootstrap';
import { useAccion } from '@/shared/hooks/useAccion';
import * as ordenesApi from '../../api';
import { ImageUploader } from '../ImageUploader';
import type { SeccionOrdenProps } from './tipos';

export function ImagenesCard({ orden, puedeEditar, onActualizada, onError }: SeccionOrdenProps) {
  const [nuevas, setNuevas] = useState<File[]>([]);
  const { enCurso, ejecutar } = useAccion(onError);
  const imagenes = orden.imagenes ?? [];

  async function subir() {
    if (
      await ejecutar(() => ordenesApi.subirImagenes(orden.id, nuevas), 'No se pudieron subir las imágenes')
    ) {
      setNuevas([]);
      onActualizada();
    }
  }

  async function eliminar(imagenId: number) {
    if (!window.confirm('¿Eliminar esta imagen?')) return;
    if (
      await ejecutar(() => ordenesApi.eliminarImagen(orden.id, imagenId), 'No se pudo eliminar la imagen')
    ) {
      onActualizada();
    }
  }

  return (
    <Card>
      <Card.Header>Imágenes del equipo</Card.Header>
      <Card.Body>
        <Row xs={2} md={4} lg={6} className="g-2 mb-3">
          {imagenes.map((img) => (
            <Col key={img.id}>
              <div className="position-relative">
                <Image src={img.url} alt={img.descripcion ?? 'Foto del equipo'} thumbnail />
                {puedeEditar && (
                  <Button
                    size="sm"
                    variant="danger"
                    className="position-absolute top-0 end-0"
                    aria-label="Eliminar imagen"
                    disabled={enCurso}
                    onClick={() => eliminar(img.id)}
                  >
                    ✕
                  </Button>
                )}
              </div>
            </Col>
          ))}
          {imagenes.length === 0 && (
            <Col xs={12}>
              <span className="text-muted">Sin imágenes cargadas</span>
            </Col>
          )}
        </Row>
        {puedeEditar && (
          <>
            <ImageUploader files={nuevas} onChange={setNuevas} disabled={enCurso} />
            {nuevas.length > 0 && (
              <Button size="sm" className="mt-2" onClick={subir} disabled={enCurso}>
                {enCurso ? <Spinner size="sm" animation="border" /> : 'Subir imágenes'}
              </Button>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
