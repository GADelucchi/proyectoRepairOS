import { ReactNode, useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { NavLink, useLocation } from 'react-router';
import { ChevronRight, ChevronsUpDown, LogOut, Settings, Store } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { AvisoAutorizaciones } from '@/features/solicitudes/components/AvisoAutorizaciones';
import { Logo } from '@/shared/components/Logo';
import { ITEMS_MENU, itemsAjustes, type ItemMenu } from './menu';

function Enlace({ item, extra, onNavegar }: { item: ItemMenu; extra?: ReactNode; onNavegar: () => void }) {
  const Icono = item.icono;
  return (
    <NavLink
      to={item.to}
      className="menu-lateral-link"
      title={item.title}
      data-tour={item.tour}
      onClick={onNavegar}
    >
      <Icono size={18} className={`icono-tono tono-${item.tono}`} aria-hidden="true" />
      <span>{item.etiqueta}</span>
      {extra}
    </NavLink>
  );
}

const iniciales = (nombre?: string, apellido?: string) =>
  `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase();

interface MenuLateralProps {
  /** Se llama al tocar un link, aunque sea la pantalla en la que ya estás (cierra el menú del celular). */
  onNavegar: () => void;
  onCambiarSucursal: () => void;
  onSalir: () => void;
}

/** Menú principal: sucursal actual, secciones con su ícono y, abajo, el usuario. */
export function MenuLateral({ onNavegar, onCambiarSucursal, onSalir }: MenuLateralProps) {
  const { usuario, esAdmin, esAdminPlataforma } = useAuth();
  const { pathname } = useLocation();
  const ajustes = itemsAjustes(esAdmin, esAdminPlataforma);
  const [ajustesAbierto, setAjustesAbierto] = useState(() =>
    ajustes.some((item) => pathname.startsWith(item.to))
  );
  const sucursalActual = usuario?.sucursales.find((s) => s.id === usuario.sucursalActualId);

  return (
    <nav className="menu-lateral" aria-label="Menú principal">
      <NavLink to="/inicio" className="menu-lateral-logo" onClick={onNavegar}>
        <Logo size={30} />
      </NavLink>

      <div className="px-2">
        <button type="button" className="menu-lateral-bloque" onClick={onCambiarSucursal}>
          <span className="chip-icono tono-blue">
            <Store size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-grow-1 lh-sm">
            <span className="d-block fw-semibold text-truncate">{sucursalActual?.nombre ?? 'Sucursal'}</span>
            <span className="d-block small text-muted text-truncate">{usuario?.taller?.nombre}</span>
          </span>
          <ChevronsUpDown size={16} className="text-muted flex-none" aria-label="Cambiar de sucursal" />
        </button>
      </div>

      <div className="menu-lateral-scroll">
        <div className="menu-lateral-seccion">Menú</div>
        {ITEMS_MENU.map((item) => (
          <Enlace
            key={item.to}
            item={item}
            onNavegar={onNavegar}
            extra={item.to === '/autorizaciones' ? <AvisoAutorizaciones /> : undefined}
          />
        ))}

        <button
          type="button"
          className="menu-lateral-link"
          aria-expanded={ajustesAbierto}
          aria-controls="menu-ajustes"
          data-tour="nav-ajustes"
          onClick={() => setAjustesAbierto((abierto) => !abierto)}
        >
          <Settings size={18} className="icono-tono tono-gris" aria-hidden="true" />
          <span>Ajustes</span>
          <ChevronRight size={16} className="flecha" aria-hidden="true" />
        </button>
        {ajustesAbierto && (
          <div id="menu-ajustes" className="menu-lateral-sub">
            {ajustes.map((item) => (
              <Enlace key={item.to} item={item} onNavegar={onNavegar} />
            ))}
          </div>
        )}
      </div>

      <div className="menu-lateral-pie">
        <Dropdown drop="up">
          <Dropdown.Toggle as="button" type="button" className="menu-lateral-bloque">
            <span className="avatar-iniciales" aria-hidden="true">
              {iniciales(usuario?.nombre, usuario?.apellido)}
            </span>
            <span className="min-w-0 flex-grow-1 lh-sm">
              <span className="d-block fw-semibold text-truncate">
                {usuario?.nombre} {usuario?.apellido}
              </span>
              <span className="d-block small text-muted text-truncate">{usuario?.email}</span>
            </span>
            <ChevronsUpDown size={16} className="text-muted flex-none" aria-hidden="true" />
          </Dropdown.Toggle>
          <Dropdown.Menu className="w-100">
            <Dropdown.Item onClick={onCambiarSucursal}>
              <Store size={16} className="me-2" aria-hidden="true" />
              Cambiar de sucursal
            </Dropdown.Item>
            <Dropdown.Item onClick={onSalir}>
              <LogOut size={16} className="me-2" aria-hidden="true" />
              Salir
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </nav>
  );
}
