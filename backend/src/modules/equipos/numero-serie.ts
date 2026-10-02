import crypto from 'crypto';
import { Equipo } from '../../models';

const MAX_INTENTOS = 20;

/**
 * Genera un número de serie único dentro del taller, para equipos que no lo
 * traen de fábrica. Formato: SN-AAAAMMDDHHMMSS-XXXXXXXXXX.
 */
export async function generarNumeroSerieUnico(tallerId: number): Promise<string> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const aleatorio = crypto.randomBytes(5).toString('hex').toUpperCase();
    const candidato = `SN-${timestamp}-${aleatorio}`;
    const existe = await Equipo.count({ where: { tallerId, numeroSerie: candidato } });
    if (existe === 0) return candidato;
  }

  throw new Error('No se pudo generar un número de serie único después de varios intentos');
}
