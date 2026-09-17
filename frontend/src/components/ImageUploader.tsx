import { useEffect, useMemo, useRef } from 'react';
import { Button, Row, Col, Image, Stack } from 'react-bootstrap';

interface ImageUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/** Selector de imágenes con previsualización, usado para fotos/detalles estéticos del equipo. */
export function ImageUploader({ files, onChange, disabled }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Una URL por archivo, revocada al cambiar la lista: si se crea en el render
  // se filtra memoria en cada re-render.
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  function handleSeleccion(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevos = Array.from(e.target.files ?? []);
    onChange([...files, ...nuevos]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function eliminar(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <Stack gap={2}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={handleSeleccion}
        disabled={disabled}
        className="form-control"
      />
      {previews.length > 0 && (
        <Row xs={3} md={5} className="g-2">
          {previews.map((preview, index) => (
            <Col key={preview.url}>
              <div className="position-relative">
                <Image src={preview.url} alt={preview.file.name} thumbnail />
                <Button
                  variant="danger"
                  size="sm"
                  className="position-absolute top-0 end-0"
                  onClick={() => eliminar(index)}
                  disabled={disabled}
                  type="button"
                  aria-label={`Quitar ${preview.file.name}`}
                >
                  ✕
                </Button>
              </div>
            </Col>
          ))}
        </Row>
      )}
    </Stack>
  );
}
