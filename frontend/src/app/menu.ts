import {
  Banknote,
  Building2,
  ChartColumn,
  ClipboardList,
  Globe,
  LayoutDashboard,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserCog,
  Users,
  Wallet,
  type LucideIcon
} from 'lucide-react';
import type { Tono } from '@/shared/constants/tonos';

export interface ItemMenu {
  to: string;
  etiqueta: string;
  icono: LucideIcon;
  tono: Tono;
  /** Marca para la guía de primeros pasos (`data-tour`). */
  tour?: string;
  title?: string;
}

export const ITEMS_MENU: ItemMenu[] = [
  { to: '/inicio', etiqueta: 'Inicio', icono: LayoutDashboard, tono: 'blue', tour: 'nav-inicio' },
  { to: '/ordenes', etiqueta: 'Órdenes', icono: ClipboardList, tono: 'violet', tour: 'nav-ordenes' },
  { to: '/clientes', etiqueta: 'Clientes', icono: Users, tono: 'green' },
  { to: '/equipos', etiqueta: 'Equipos', icono: Smartphone, tono: 'cyan' },
  { to: '/cuentas', etiqueta: 'Cuentas', icono: Wallet, tono: 'amber', title: 'Cuenta corriente' },
  { to: '/caja', etiqueta: 'Caja', icono: Banknote, tono: 'green', tour: 'nav-caja' },
  { to: '/reportes', etiqueta: 'Reportes', icono: ChartColumn, tono: 'indigo', tour: 'nav-reportes' },
  { to: '/autorizaciones', etiqueta: 'Autorizaciones', icono: ShieldCheck, tono: 'red' }
];

/** Los ítems de "Ajustes" que ve este usuario. */
export function itemsAjustes(esAdmin: boolean, esAdminPlataforma: boolean): ItemMenu[] {
  return [
    { to: '/configuracion', etiqueta: 'Configuración', icono: SlidersHorizontal, tono: 'gris' },
    ...(esAdmin
      ? [
          { to: '/admin/usuarios', etiqueta: 'Usuarios', icono: UserCog, tono: 'gris' as const },
          { to: '/admin/sucursales', etiqueta: 'Sucursales', icono: Building2, tono: 'gris' as const }
        ]
      : []),
    ...(esAdminPlataforma
      ? [{ to: '/plataforma', etiqueta: 'Plataforma', icono: Globe, tono: 'gris' as const }]
      : [])
  ];
}

/** Nombre de la sección en la que está el usuario, para el encabezado. */
export function seccionActual(pathname: string, items: ItemMenu[]): string | null {
  return items.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.etiqueta ?? null;
}
