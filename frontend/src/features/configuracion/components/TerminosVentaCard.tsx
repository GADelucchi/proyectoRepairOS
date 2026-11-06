import { FormEvent, useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { useAccion } from '@/shared/hooks/useAccion';
import { textoONull } from '@/shared/utils/texto';
import * as configuracionApi from '../api';

interface TerminosVentaCardProps {
  onError: (mensaje: string) => void;
  onGuardado: (mensaje: string) => void;
}

/** Un punto de partida: cada taller lo adapta a su garantía y su forma de trabajar. */
const EJEMPLO = `Garantía de 90 días en equipos usados y de 12 meses en nuevos (la del fabricante), contados desde la entrega.
La garantía no cubre golpes, humedad, pantallas rotas ni equipos abiertos o reparados por terceros.
Las reservas sin pago se mantienen hasta la fecha indicada en este comprobante.
Conservá este comprobante: hace falta para usar la garantía.`;

/** Términos y condiciones que se imprimen en el comprobante de cada venta de equipos (solo admin). */
export function TerminosVentaCard({ onError, onGuardado }: TerminosVentaCardProps) {
  const { usuario, refrescar } = useAuth();
  const guardados = usuario?.taller?.terminosVenta ?? '';
  const [texto, setTexto] = useState(guardados);
  const { enCurso, ejecutar } = useAccion(onError);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const ok = await ejecutar(async () => {
      await configuracionApi.actualizarTaller({ terminosVenta: textoONull(texto) });
      await refrescar();
    }, 'No se pudieron guardar los términos');
    if (ok) onGuardado('Términos de venta guardados');
  }

  return (
    <Card className="mb-4">
      <Card.Header>Términos y condiciones de venta</Card.Header>
      <Card.Body>
        <Form onSubmit={guardar}>
          <Form.Control
            as="textarea"
            rows={6}
            maxLength={10000}
            aria-label="Términos y condiciones de venta"
            placeholder={EJEMPLO}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <Form.Text className="text-muted d-block">
            Se imprimen en el comprobante de cada venta de equipos, junto con el nombre, el CUIT y la
            dirección del taller.
          </Form.Text>
          <div className="d-flex gap-2 mt-2">
            <Button type="submit" disabled={enCurso || texto === guardados}>
              Guardar
            </Button>
            {!texto && (
              <Button variant="outline-secondary" onClick={() => setTexto(EJEMPLO)}>
                Usar el ejemplo
              </Button>
            )}
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
