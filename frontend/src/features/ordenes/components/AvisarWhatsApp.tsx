import { useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { linkWhatsApp, telefonoParaWhatsApp } from '@/shared/utils/whatsapp';
import { type DatosAviso, mensajeParaCliente } from '../aviso-cliente';

function IconoWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="me-1">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

interface AvisarWhatsAppProps {
  datos: DatosAviso;
  size?: 'sm' | 'lg';
  /** Texto del botón; sin texto, solo el ícono. */
  texto?: string;
  className?: string;
}

/**
 * Botón que abre WhatsApp con un mensaje para el cliente ya escrito según el
 * estado de la orden. Se puede corregir el número y el texto antes de mandarlo.
 *
 * Usa wa.me: no necesita la API oficial de WhatsApp (ni su aprobación), pero el
 * mensaje lo manda la persona desde su propio WhatsApp.
 */
export function AvisarWhatsApp({ datos, size, texto = 'WhatsApp', className }: AvisarWhatsAppProps) {
  const { usuario } = useAuth();
  const pais = usuario?.taller?.pais ?? 'AR';
  const taller = usuario?.taller?.nombre ?? 'el taller';
  const [abierto, setAbierto] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [mensaje, setMensaje] = useState('');

  function abrir() {
    setTelefono(datos.clienteTelefono ?? '');
    setMensaje(mensajeParaCliente(datos, taller));
    setAbierto(true);
  }

  const numero = telefonoParaWhatsApp(telefono, pais);

  return (
    <>
      <Button
        size={size}
        variant="success"
        className={className}
        onClick={abrir}
        title="Avisar al cliente por WhatsApp"
        aria-label="Avisar al cliente por WhatsApp"
      >
        <IconoWhatsApp />
        {texto}
      </Button>

      <Modal show={abierto} onHide={() => setAbierto(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Avisar por WhatsApp</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3" controlId="wa-telefono">
            <Form.Label>Teléfono del cliente</Form.Label>
            <Form.Control
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 221 555-1234"
              isInvalid={telefono !== '' && !numero}
            />
            <Form.Text className="text-muted">
              {numero
                ? `Se abre WhatsApp con el +${numero}.`
                : 'Sin un teléfono válido, WhatsApp te deja elegir el contacto.'}
            </Form.Text>
          </Form.Group>
          <Form.Group controlId="wa-mensaje">
            <Form.Label>Mensaje</Form.Label>
            <Form.Control
              as="textarea"
              rows={6}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            variant="success"
            href={linkWhatsApp(numero, mensaje)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAbierto(false)}
            disabled={!mensaje.trim()}
          >
            <IconoWhatsApp />
            Abrir WhatsApp
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
