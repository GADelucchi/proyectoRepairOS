import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { leerCodigo, obtenerDetector } from '@/shared/utils/lector-codigos';

interface EscanerCodigosProps {
  show: boolean;
  titulo: string;
  /**
   * Convierte lo leído en el valor del campo, o devuelve null si no sirve (un
   * serial cuando se esperaba un IMEI): en ese caso se avisa y se sigue leyendo.
   */
  aceptar?: (texto: string) => string | null;
  /** Qué se esperaba, para el aviso cuando lo leído no sirve. */
  esperado?: string;
  onLeido: (valor: string) => void;
  onCerrar: () => void;
}

/** Cada cuánto se analiza un cuadro del video: más seguido no lee mejor y gasta batería. */
const INTERVALO_MS = 180;

/**
 * Lee un código de barras o QR con la cámara trasera. En el celular ocupa toda
 * la pantalla. Si no hay cámara (o no hay permiso), se puede sacar una foto.
 */
export function EscanerCodigos({ show, titulo, aceptar, esperado, onLeido, onCerrar }: EscanerCodigosProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<'iniciando' | 'leyendo' | 'sin_camara'>('iniciando');
  const [aviso, setAviso] = useState<string | null>(null);
  // Las funciones cambian en cada render del padre; el bucle usa siempre las últimas.
  const callbacks = useRef({ aceptar, onLeido });
  callbacks.current = { aceptar, onLeido };

  /** true si lo leído sirvió y se entregó. */
  const procesar = useRef((texto: string): boolean => {
    const valor = callbacks.current.aceptar ? callbacks.current.aceptar(texto) : texto;
    if (valor === null) {
      setAviso(
        `Se leyó "${texto}", que no parece ${esperado ?? 'el código buscado'}. Probá con otra etiqueta.`
      );
      return false;
    }
    callbacks.current.onLeido(valor);
    return true;
  });

  useEffect(() => {
    if (!show) return;
    setEstado('iniciando');
    setAviso(null);
    let activo = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ultimoRechazado = '';

    async function bucle() {
      const video = videoRef.current;
      if (!activo || !video) return;
      if (video.readyState >= 2) {
        try {
          const texto = await leerCodigo(video);
          if (texto && texto !== ultimoRechazado) {
            if (procesar.current(texto)) return;
            ultimoRechazado = texto;
          }
        } catch {
          // Un cuadro que no se pudo analizar no corta la lectura.
        }
      }
      if (activo) timer = setTimeout(bucle, INTERVALO_MS);
    }

    (async () => {
      try {
        // Se descarga el lector mientras se abre la cámara.
        const [, camara] = await Promise.all([
          obtenerDetector(),
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          })
        ]);
        stream = camara;
        if (!activo || !videoRef.current) {
          camara.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = camara;
        await videoRef.current.play();
        setEstado('leyendo');
        bucle();
      } catch {
        if (activo) setEstado('sin_camara');
      }
    })();

    return () => {
      activo = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [show]);

  async function leerFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      const texto = await leerCodigo(archivo);
      if (!texto) {
        setAviso('No se encontró un código en la foto. Probá más cerca, derecho y con buena luz.');
        return;
      }
      procesar.current(texto);
    } catch {
      setAviso('No se pudo leer la foto.');
    }
  }

  return (
    <Modal show={show} onHide={onCerrar} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h5">{titulo}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-2">
        {aviso && (
          <Alert variant="warning" className="py-2 small" dismissible onClose={() => setAviso(null)}>
            {aviso}
          </Alert>
        )}
        <div className="position-relative bg-black rounded overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
          <video ref={videoRef} className="w-100 h-100" style={{ objectFit: 'cover' }} muted playsInline />
          {estado === 'leyendo' && (
            // Guía: los códigos de las cajas son anchos y bajos.
            <div
              className="position-absolute top-50 start-50 translate-middle border border-2 border-warning rounded"
              style={{ width: '80%', height: '30%', boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }}
              aria-hidden
            />
          )}
          {estado === 'iniciando' && (
            <div className="position-absolute top-50 start-50 translate-middle text-light text-center">
              <Spinner animation="border" />
              <div className="small mt-2">Abriendo cámara…</div>
            </div>
          )}
          {estado === 'sin_camara' && (
            <div className="position-absolute top-50 start-50 translate-middle text-light text-center px-3">
              No se pudo abrir la cámara. Revisá el permiso del navegador o sacá una foto de la etiqueta.
            </div>
          )}
        </div>
        <p className="text-muted small mt-2 mb-2">
          Centrá el código en el recuadro, a unos 10–15 cm. Si la caja tiene varios, tapá los otros con el
          dedo.
        </p>
        <Form.Group controlId="escaner-foto">
          <Form.Label className="btn btn-outline-secondary w-100 mb-0">Leer desde una foto</Form.Label>
          <Form.Control
            type="file"
            accept="image/*"
            capture="environment"
            className="d-none"
            onChange={leerFoto}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
