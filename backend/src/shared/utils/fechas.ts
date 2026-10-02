/**
 * Fechas en la zona horaria del negocio.
 *
 * El servidor corre en UTC (Render, Railway) y la base guarda los timestamps en
 * UTC. "Hoy", "la caja del día" y la hora impresa en el remito, en cambio, son
 * del taller: a las 22 hs en Buenos Aires ya es mañana en UTC.
 */

/** Diferencia en minutos entre la hora local de `zona` y UTC en ese instante. */
function desfasajeMinutos(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(instante);

  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const comoUtc = Date.UTC(
    valor('year'),
    valor('month') - 1,
    valor('day'),
    valor('hour'),
    valor('minute'),
    valor('second')
  );
  return Math.round((comoUtc - instante.getTime()) / 60_000);
}

/** Fecha de calendario (YYYY-MM-DD) de un instante, vista desde `zona`. */
export function fechaEnZona(instante: Date, zona: string): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(instante);
}

/** Instante UTC en que empieza el día `fecha` (YYYY-MM-DD) en `zona`. */
export function inicioDelDia(fecha: string, zona: string): Date {
  const medianocheUtc = new Date(`${fecha}T00:00:00Z`);
  return new Date(medianocheUtc.getTime() - desfasajeMinutos(medianocheUtc, zona) * 60_000);
}

/** Suma días a una fecha de calendario sin pasar por la zona horaria local. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** true si `fecha` es un YYYY-MM-DD que existe en el calendario (rechaza 2026-02-31). */
export function esFechaIsoValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** DD/MM/AAAA HH:mm de un instante, vista desde `zona`. */
export function formatearFechaHora(instante: Date | string, zona: string): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  if (Number.isNaN(d.getTime())) return '-';
  const texto = new Intl.DateTimeFormat('es-AR', {
    timeZone: zona,
    hourCycle: 'h23',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
  return texto.replace(',', '');
}

/** DD/MM/AAAA de una fecha de calendario YYYY-MM-DD, sin pasar por Date. */
export function formatearFechaIso(fecha: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : fecha;
}
