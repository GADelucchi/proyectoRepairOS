import { useState } from 'react';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';

/** El link del portal donde los clientes del taller consultan sus datos y su cuenta. */
export function PortalClientesCard() {
  const link = useAuth().usuario?.taller?.portalClientes;
  const [copiado, setCopiado] = useState(false);
  if (!link) return null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link!);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin portapapeles el link sigue a la vista para copiarlo a mano.
    }
  }

  return (
    <Card className="mb-4">
      <Card.Header>Portal de clientes</Card.Header>
      <Card.Body>
        <p className="small text-muted">
          Compartí este link (por WhatsApp, en el local, en tus redes): cada cliente ve sus órdenes y su
          cuenta corriente con su DNI y los últimos 4 dígitos de su teléfono.
        </p>
        <InputGroup>
          <Form.Control
            value={link}
            readOnly
            aria-label="Link del portal de clientes"
            onFocus={(e) => e.target.select()}
          />
          <Button variant="outline-secondary" onClick={copiar}>
            {copiado ? 'Copiado ✓' : 'Copiar'}
          </Button>
        </InputGroup>
      </Card.Body>
    </Card>
  );
}
