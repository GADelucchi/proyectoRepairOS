import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import QrScanner from 'qr-scanner';
import * as equiposApi from '../api';
import { idDeEquipoEnQr } from '../qr';

/**
 * Lector de las etiquetas QR de los equipos.
 *
 * Usa la cámara trasera del dispositivo. Si no hay cámara o se negó el
 * permiso, se puede sacar una foto del QR y leerla desde el archivo. La cámara
 * nativa del celular también sirve: el QR es un link a la ficha del equipo.
 */
export function EscanearQrPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<'iniciando' | 'escaneando' | 'sin_camara' | 'buscando'>('iniciando');
  const [error, setError] = useState<string | null>(null);
  // La cámara lee el mismo QR varias veces por segundo: se procesa una sola.
  const procesando = useRef(false);

  /** Lleva a la ficha del equipo o explica por qué el código no sirve. */
  const resolver = useCallback(
    async (texto: string) => {
      if (procesando.current) return;
      procesando.current = true;
      setError(null);

      const id = idDeEquipoEnQr(texto);
      if (id) {
        navigate(`/equipos/${id}`);
        return;
      }

      // Un QR que no es de RepairOS puede traer el número de serie impreso por el fabricante.
      setEstado('buscando');
      try {
        const serie = texto.trim();
        const coincidencias = (await equiposApi.listarEquipos({ search: serie })).filter(
          (e) => e.numeroSerie?.toLowerCase() === serie.toLowerCase()
        );
        if (coincidencias.length === 1) {
          navigate(`/equipos/${coincidencias[0].id}`);
          return;
        }
        setError('Ese código no es una etiqueta de RepairOS ni el número de serie de un equipo cargado.');
      } catch {
        setError('No se pudo buscar el equipo. Revisá la conexión e intentá de nuevo.');
      }
      setEstado('escaneando');
      // Pausa corta para que el mismo código no vuelva a disparar el error al instante.
      setTimeout(() => (procesando.current = false), 2000);
    },
    [navigate]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const lector = new QrScanner(video, (resultado) => resolver(resultado.data), {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      highlightCodeOutline: true,
      returnDetailedScanResult: true
    });

    lector
      .start()
      .then(() => setEstado('escaneando'))
      .catch(() => setEstado('sin_camara'));

    return () => lector.destroy();
  }, [resolver]);

  async function leerFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      const resultado = await QrScanner.scanImage(archivo, { returnDetailedScanResult: true });
      procesando.current = false;
      await resolver(resultado.data);
    } catch {
      setError('No se encontró un QR en la foto. Probá de más cerca y con buena luz.');
    }
  }

  return (
    <div style={{ maxWidth: 520 }} className="mx-auto">
      <h3 className="mb-3">Escanear QR de equipo</h3>

      {error && (
        <Alert variant="warning" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card className="mb-3">
        <Card.Body className="p-2">
          <div
            className="position-relative bg-black rounded overflow-hidden"
            style={{ aspectRatio: '1 / 1' }}
          >
            <video ref={videoRef} className="w-100 h-100" style={{ objectFit: 'cover' }} muted playsInline />
            {(estado === 'iniciando' || estado === 'buscando') && (
              <div className="position-absolute top-50 start-50 translate-middle text-light text-center">
                <Spinner animation="border" />
                <div className="small mt-2">
                  {estado === 'buscando' ? 'Buscando equipo…' : 'Abriendo cámara…'}
                </div>
              </div>
            )}
            {estado === 'sin_camara' && (
              <div className="position-absolute top-50 start-50 translate-middle text-light text-center px-3">
                No se pudo abrir la cámara. Revisá el permiso del navegador o sacá una foto del QR.
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      <Form.Group controlId="qr-foto">
        <Form.Label className="btn btn-outline-secondary w-100 mb-0">Leer desde una foto</Form.Label>
        <Form.Control
          type="file"
          accept="image/*"
          capture="environment"
          className="d-none"
          onChange={leerFoto}
        />
      </Form.Group>
      <Button variant="link" className="w-100 mt-2" onClick={() => navigate('/equipos')}>
        Ir al listado de equipos
      </Button>
    </div>
  );
}
