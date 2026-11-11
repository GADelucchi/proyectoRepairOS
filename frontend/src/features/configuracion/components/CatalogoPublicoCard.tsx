import { useState } from 'react';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { apiClient } from '@/shared/api/client';
import { useAccion } from '@/shared/hooks/useAccion';
import * as configuracionApi from '../api';

interface CatalogoPublicoCardProps {
  onError: (mensaje: string) => void;
  onGuardado: (mensaje: string) => void;
}

/** La URL completa de la API, aunque `baseURL` sea relativa ("/api"). */
function urlDelCatalogo(codigo: string): string {
  const base = (apiClient.defaults.baseURL ?? '/api').replace(/\/?$/, '/');
  return new URL(`catalogo/${codigo}`, new URL(base, window.location.origin)).toString();
}

/** Publicar el stock disponible con su precio en un link público (solo admin). */
export function CatalogoPublicoCard({ onError, onGuardado }: CatalogoPublicoCardProps) {
  const { usuario, refrescar } = useAuth();
  const publicado = usuario?.taller?.catalogoPublico ?? false;
  const codigo = usuario?.taller?.codigoPublico;
  const pagina = usuario?.taller?.catalogoClientes;
  const { enCurso, ejecutar } = useAccion(onError);
  const [copiado, setCopiado] = useState(false);
  const api = codigo ? urlDelCatalogo(codigo) : null;

  async function alternar(valor: boolean) {
    const ok = await ejecutar(async () => {
      await configuracionApi.actualizarTaller({ catalogoPublico: valor });
      await refrescar();
    }, 'No se pudo cambiar la opción');
    if (ok)
      onGuardado(
        valor ? 'El catálogo de equipos ya es público' : 'El catálogo de equipos dejó de ser público'
      );
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(pagina!);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin portapapeles el link sigue a la vista para copiarlo a mano.
    }
  }

  return (
    <Card className="mb-4">
      <Card.Header>Catálogo público de equipos</Card.Header>
      <Card.Body>
        <Form.Check
          type="switch"
          id="catalogo-publico"
          label="Publicar los equipos en venta"
          checked={publicado}
          disabled={enCurso}
          onChange={(e) => alternar(e.target.checked)}
        />
        <Form.Text className="text-muted d-block mb-3">
          Se ven los equipos disponibles que tienen precio de venta: marca, modelo, memoria, color, nuevo o
          usado, batería de los usados, precio y sucursal. Nunca el costo, el proveedor ni el IMEI. Lo
          reservado o señado no aparece.
        </Form.Text>
        {publicado && pagina && (
          <>
            <p className="small text-muted mb-2">
              Compartí este link en tus redes o por WhatsApp: tus clientes ven los equipos, los filtran y te
              consultan por WhatsApp al teléfono de la sucursal.
            </p>
            <InputGroup>
              <Form.Control
                value={pagina}
                readOnly
                aria-label="Link del catálogo público"
                onFocus={(e) => e.target.select()}
              />
              <Button
                variant="outline-secondary"
                as="a"
                href={pagina}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir
              </Button>
              <Button variant="outline-secondary" onClick={copiar}>
                {copiado ? 'Copiado ✓' : 'Copiar'}
              </Button>
            </InputGroup>
            {api && (
              <Form.Text className="text-muted d-block mt-2">
                Para mostrarlos en tu propia web o sistema, los mismos datos están en formato JSON en{' '}
                <code className="text-break">{api}</code>
              </Form.Text>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
