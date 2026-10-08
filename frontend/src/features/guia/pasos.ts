/**
 * Pasos de la guía de primeros pasos. Cada uno señala un elemento marcado con
 * `data-tour="…"`; sin elemento (o si no está a la vista, como el menú cerrado
 * en el celular) el globo se muestra centrado.
 */
export interface PasoGuia {
  /** Valor de `data-tour` del elemento a señalar. Sin él, el paso va centrado. */
  objetivo?: string;
  titulo: string;
  texto: string;
  /** Solo para admins: un técnico no puede crear sucursales ni usuarios. */
  soloAdmin?: boolean;
}

export const PASOS_GUIA: PasoGuia[] = [
  {
    titulo: 'Bienvenido a RepairOS',
    texto:
      'En un minuto te mostramos dónde está cada cosa y qué conviene configurar primero. Podés salir cuando quieras y volver a verla con el botón "?" del menú.'
  },
  {
    objetivo: 'nav-ajustes',
    soloAdmin: true,
    titulo: 'Paso 1: tu sucursal',
    texto:
      'En Ajustes → Sucursales. Es el local donde recibís los equipos: cargale la dirección y el teléfono, que salen en el remito y en la página de seguimiento que ve el cliente.'
  },
  {
    objetivo: 'nav-ajustes',
    titulo: 'Paso 2: configuración',
    texto:
      'En Ajustes → Configuración revisá el país del taller (define la moneda de las órdenes) y armá los tipos de equipo con su checklist de recepción: lo que revisás cuando entra cada celular, notebook o consola.'
  },
  {
    objetivo: 'nav-ajustes',
    soloAdmin: true,
    titulo: 'Paso 3: tu equipo',
    texto:
      'En Ajustes → Usuarios sumá a tus técnicos, cada uno con su usuario. Cada cambio de estado y cada cobro queda registrado con quién lo hizo.'
  },
  {
    objetivo: 'nav-inicio',
    titulo: 'Inicio: el tablero del día',
    texto:
      'Lo primero que conviene mirar al abrir: equipos listos para avisar, presupuestos sin respuesta y órdenes atrasadas.'
  },
  {
    objetivo: 'nav-ordenes',
    titulo: 'Órdenes',
    texto:
      'Cada equipo que entra: cliente, checklist, fotos, presupuesto y firma. Desde la orden le avisás al cliente por WhatsApp, y él sigue el estado con el QR del remito.'
  },
  {
    objetivo: 'nav-escanear',
    titulo: 'Etiquetas QR',
    texto:
      'Imprimí una etiqueta con QR para cada equipo (desde Equipos) y pegala atrás. Con este botón escaneás la etiqueta y ves el equipo y su historial al instante.'
  },
  {
    objetivo: 'nav-caja',
    titulo: 'Cuenta corriente y caja',
    texto:
      'Quién debe, qué se cobró hoy y por qué medio. Fiar o ajustar un saldo pide la autorización de un admin.'
  },
  {
    objetivo: 'nav-reportes',
    titulo: 'Reportes',
    texto:
      'Tiempo promedio de reparación, presupuestos aprobados, trabajo de cada técnico y equipos que nadie vino a buscar. Todo se puede bajar a Excel.'
  },
  {
    objetivo: 'campanita',
    titulo: 'Avisos',
    texto: 'Acá llegan las autorizaciones pendientes y las novedades. El número indica cuántas no leíste.'
  },
  {
    objetivo: 'ayuda',
    titulo: '¡Listo!',
    texto: 'Ya podés cargar tu primera orden. Si querés repasar algo, tocá este botón cuando quieras.'
  }
];

/** Evento con el que cualquier pantalla vuelve a abrir la guía. */
export const EVENTO_ABRIR_GUIA = 'repairos:abrir-guia';

export const abrirGuia = () => window.dispatchEvent(new Event(EVENTO_ABRIR_GUIA));

const claveVista = (usuarioId: number) => `repairos_guia_vista_${usuarioId}`;

/** La guía se abre sola una vez por usuario y navegador. */
export const guiaVista = {
  leer: (usuarioId: number) => {
    try {
      return localStorage.getItem(claveVista(usuarioId)) === '1';
    } catch {
      // Sin almacenamiento no se puede recordar: mejor no abrirla sola cada vez.
      return true;
    }
  },
  marcar: (usuarioId: number) => {
    try {
      localStorage.setItem(claveVista(usuarioId), '1');
    } catch {
      // Nada que hacer.
    }
  }
};
