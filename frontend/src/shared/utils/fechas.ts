/**
 * Utilidades de fecha.
 *
 * Regla del módulo: las fechas "de calendario" (fecha pactada, fecha de
 * nacimiento) viajan como `YYYY-MM-DD` y NUNCA se pasan por `new Date(string)`,
 * porque el motor de JS interpreta ese formato como UTC medianoche y al leerlo
 * con `getDate()` en horario local devuelve el día anterior en toda América.
 * Los timestamps completos (createdAt, fechaIngreso) sí llevan zona horaria y se
 * pueden parsear normalmente.
 */

/** Separa un `YYYY-MM-DD` en números, sin construir un Date. */
function partesISO(fechaISO: string): { anio: number; mes: number; dia: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaISO.trim());
  if (!match) return null;
  return { anio: Number(match[1]), mes: Number(match[2]), dia: Number(match[3]) };
}

/** Valida que la combinación día/mes/año exista realmente (rechaza 31/02). */
export function esFechaValida(dia: number, mes: number, anio: number): boolean {
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(anio)) return false;
  if (mes < 1 || mes > 12 || dia < 1 || anio < 1900 || anio > 2100) return false;
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return dia <= diasEnMes;
}

/** Formatea una fecha al formato DD/MM/YYYY (las de calendario, sin pasar por Date). */
export function formatearFecha(fecha: string | Date | null | undefined): string {
  if (!fecha) return '-';

  if (typeof fecha === 'string') {
    const soloFecha = partesISO(fecha);
    // Un `YYYY-MM-DD` pelado es fecha de calendario: se muestra tal cual.
    if (soloFecha && !/[T ]\d{2}:/.test(fecha)) {
      const { anio, mes, dia } = soloFecha;
      return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
    }
  }

  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(date.getTime())) return '-';

  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();

  return `${dia}/${mes}/${anio}`;
}

/** Formatea la hora de un timestamp al formato HH:mm (24 horas). */
export function formatearHora(fecha: string | Date | null | undefined): string {
  if (!fecha) return '-';

  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(date.getTime())) return '-';

  const horas = String(date.getHours()).padStart(2, '0');
  const minutos = String(date.getMinutes()).padStart(2, '0');

  return `${horas}:${minutos}`;
}

/** Formatea fecha y hora (DD/MM/YYYY HH:mm). */
export function formatearFechaHora(fecha: string | Date | null | undefined): string {
  if (!fecha) return '-';

  return `${formatearFecha(fecha)} ${formatearHora(fecha)}`;
}

/**
 * Convierte DD/MM/YYYY al formato ISO (YYYY-MM-DD) que espera el backend.
 * Devuelve `null` si la fecha no existe en el calendario, para que el llamador
 * pueda avisar en vez de guardar silenciosamente un valor vacío.
 */
export function convertirAFormatoBackend(fechaDDMMYYYY: string): string | null {
  const texto = fechaDDMMYYYY.trim();
  if (!texto) return null;

  const partes = texto.split('/');
  if (partes.length !== 3) return null;

  const [dia, mes, anio] = partes.map((p) => parseInt(p, 10));
  if (!esFechaValida(dia, mes, anio)) return null;

  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Convierte el `YYYY-MM-DD` del backend a DD/MM/YYYY para mostrar.
 * No usa `new Date`: evita el corrimiento de un día por zona horaria.
 */
export function convertirDesdeBackend(fechaISO: string | null | undefined): string {
  if (!fechaISO) return '';

  const partes = partesISO(fechaISO);
  if (!partes) return '';

  const { anio, mes, dia } = partes;
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
}

/**
 * Valida lo que el usuario tipeó en un campo DD/MM/YYYY.
 * Devuelve el mensaje de error, o `null` si está bien (o vacío).
 */
export function validarFechaDDMMYYYY(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return 'Formato inválido. Usá DD/MM/AAAA.';
  return convertirAFormatoBackend(texto) === null ? 'Esa fecha no existe en el calendario.' : null;
}

/**
 * Fecha de calendario (YYYY-MM-DD) en la hora local del navegador.
 *
 * No usa `toISOString()`, que devuelve la fecha en UTC: en Argentina, después
 * de las 21 hs eso ya es mañana.
 */
export function fechaLocalISO(fecha: Date = new Date()): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Hoy menos `dias`, como fecha local YYYY-MM-DD. */
export function haceDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fechaLocalISO(fecha);
}
