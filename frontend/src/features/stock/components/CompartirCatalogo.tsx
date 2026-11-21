import { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router';
import { Check, Share2 } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { linkWhatsApp } from '@/shared/utils/whatsapp';

/** El texto con el que sale el link por WhatsApp o al compartirlo desde el celular. */
const mensajeCatalogo = (link: string) => `Mirá los equipos que tenemos a la venta: ${link}`;

/**
 * El link del catálogo público, a mano en el stock para mandárselo a un cliente.
 *
 * Publicado, lo puede compartir cualquiera del taller (es público). Sin
 * publicar, un admin ve el atajo a Configuración para activarlo; el resto, nada.
 */
export function CompartirCatalogo() {
  const { usuario, esAdmin } = useAuth();
  const [copiado, setCopiado] = useState(false);
  const publicado = usuario?.taller?.catalogoPublico ?? false;
  const link = usuario?.taller?.catalogoClientes;

  if (!publicado || !link) {
    if (!esAdmin) return null;
    return (
      <Link
        className="btn btn-outline-secondary"
        to="/configuracion#catalogo"
        title="Mostrá los equipos disponibles con su precio en un link para tus clientes"
        aria-label="Publicar catálogo"
      >
        <Share2 size={16} aria-hidden="true" />
        {/* En el celular va solo el ícono: si no, los botones del encabezado no entran en una línea. */}
        <span className="d-none d-sm-inline ms-1">Publicar catálogo</span>
      </Link>
    );
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link!);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin portapapeles: queda "Abrir el catálogo" para copiarlo de la barra.
    }
  }

  const puedeCompartir = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  async function compartir() {
    try {
      await navigator.share({ title: usuario?.taller?.nombre, text: mensajeCatalogo(link!), url: link! });
    } catch {
      // Cerró la hoja de compartir sin elegir: no es un error.
    }
  }

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant={copiado ? 'outline-success' : 'outline-secondary'}
        id="compartir-catalogo"
        aria-label={copiado ? 'Link copiado' : 'Compartir catálogo'}
      >
        {copiado ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
        {/* En el celular va solo el ícono: si no, los botones del encabezado no entran en una línea. */}
        <span className="d-none d-sm-inline ms-1">{copiado ? 'Link copiado' : 'Compartir catálogo'}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Header className="text-wrap" style={{ maxWidth: 280 }}>
          Los equipos disponibles con su precio, para tus clientes.
        </Dropdown.Header>
        <Dropdown.Item onClick={copiar}>Copiar link</Dropdown.Item>
        <Dropdown.Item
          href={linkWhatsApp(null, mensajeCatalogo(link))}
          target="_blank"
          rel="noopener noreferrer"
        >
          Enviar por WhatsApp
        </Dropdown.Item>
        {puedeCompartir && <Dropdown.Item onClick={compartir}>Compartir…</Dropdown.Item>}
        <Dropdown.Item href={link} target="_blank" rel="noopener noreferrer">
          Abrir el catálogo
        </Dropdown.Item>
        {esAdmin && (
          <>
            <Dropdown.Divider />
            <Dropdown.Item as={Link} to="/configuracion#catalogo">
              Configurar
            </Dropdown.Item>
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}
