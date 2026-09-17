import crypto from 'crypto';
import { Equipo } from '../models/Equipo';
import { HttpError } from '../middlewares/errorHandler';

const MAX_INTENTOS = 20;

/**
 * Genera un número de serie único dentro del taller, para equipos que no lo
 * traen de fábrica.
 * Formato: SN-YYYYMMDDHHMMSS-XXXXXXXXXX (ej: SN-20260726143022-A7F2Q9X1K3)
 */
export async function generarNumeroSerieUnico(tallerId: number): Promise<string> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const aleatorio = crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 10);
    const candidato = `SN-${timestamp}-${aleatorio}`;

    const existe = await Equipo.count({ where: { tallerId, numeroSerie: candidato } });
    if (existe === 0) return candidato;
  }

  throw new HttpError(500, 'No se pudo generar un número de serie único después de varios intentos');
}
