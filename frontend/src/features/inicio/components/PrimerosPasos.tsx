import { useState } from 'react';
import { Button, Card, ListGroup } from 'react-bootstrap';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { abrirGuia } from '@/features/guia/pasos';
import type { Tablero } from '@/features/reportes/api';

const claveOculta = (tallerId: number) => `repairos_primeros_pasos_ocultos_${tallerId}`;

function leerOculta(tallerId: number | undefined): boolean {
  if (!tallerId) return false;
  try {
    return localStorage.getItem(claveOculta(tallerId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Lo que le falta configurar a un taller nuevo, en orden. Desaparece sola
 * cuando está todo hecho, o si la cierran.
 */
export function PrimerosPasos({ pasos }: { pasos: Tablero['primerosPasos'] }) {
  const { usuario, esAdmin } = useAuth();
  const tallerId = usuario?.taller?.id;
  const [oculta, setOculta] = useState(() => leerOculta(tallerId));

  const items = [
    { hecho: true, texto: 'Crear tu sucursal', link: esAdmin ? '/admin/sucursales' : null },
    {
      hecho: pasos.tiposEquipo > 0,
      texto: 'Configurar los tipos de equipo y su checklist de recepción',
      link: '/configuracion'
    },
    ...(esAdmin
      ? [{ hecho: pasos.usuarios > 1, texto: 'Sumar a tus técnicos', link: '/admin/usuarios' }]
      : []),
    { hecho: pasos.ordenes > 0, texto: 'Cargar la primera orden', link: '/ordenes/nueva' }
  ];
  const pendientes = items.filter((i) => !i.hecho).length;

  if (oculta || pendientes === 0) return null;

  function ocultar() {
    setOculta(true);
    try {
      if (tallerId) localStorage.setItem(claveOculta(tallerId), '1');
    } catch {
      // Sin almacenamiento vuelve a aparecer la próxima vez.
    }
  }

  return (
    <Card className="mb-3 border-info">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Primeros pasos · te {pendientes === 1 ? 'falta 1' : `faltan ${pendientes}`}</span>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-info" onClick={abrirGuia}>
            Ver la guía
          </Button>
          <Button size="sm" variant="link" className="text-muted" onClick={ocultar}>
            Ocultar
          </Button>
        </div>
      </Card.Header>
      <ListGroup variant="flush">
        {items.map((item) => (
          <ListGroup.Item key={item.texto} className="d-flex align-items-center gap-2">
            <span className={item.hecho ? 'text-success' : 'text-muted'} aria-hidden="true">
              {item.hecho ? '✓' : '○'}
            </span>
            {item.hecho || !item.link ? (
              <span className={item.hecho ? 'text-muted text-decoration-line-through' : ''}>
                {item.texto}
              </span>
            ) : (
              <Link to={item.link}>{item.texto}</Link>
            )}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Card>
  );
}
