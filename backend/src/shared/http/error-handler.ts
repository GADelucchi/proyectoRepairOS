import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { ZodError } from 'zod';
import { HttpError } from './http-error';
import { ERROR_FORMATO_IMAGEN } from '../middlewares/upload.middleware';

/**
 * Mensaje para cada columna única cuando el alta o la edición la repite.
 * MySQL informa el nombre del índice (`uq_equipos_taller_numero_serie`) o de la
 * columna, así que se busca por coincidencia parcial.
 */
const MENSAJES_DUPLICADO: Record<string, string> = {
  email: 'Ya existe un usuario con ese email',
  numero_serie: 'Ya existe un equipo con ese número de serie en el taller',
  nombre: 'Ya existe un registro con ese nombre',
  numero_orden: 'Ese número de orden ya está en uso'
};

const MENSAJES_SUBIDA: Record<string, string> = {
  LIMIT_FILE_SIZE: 'La imagen supera el tamaño máximo de 10 MB',
  LIMIT_FILE_COUNT: 'Se pueden subir hasta 10 imágenes por vez',
  LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado'
};

function mensajeDuplicado(err: UniqueConstraintError): string {
  const campos = [...Object.keys(err.fields ?? {}), ...err.errors.map((e) => e.path ?? '')];
  const clave = Object.keys(MENSAJES_DUPLICADO).find((k) => campos.some((c) => c.includes(k)));
  return clave ? MENSAJES_DUPLICADO[clave] : 'Ya existe un registro con esos datos';
}

/**
 * Convierte cualquier error en una respuesta JSON con el status que corresponde.
 * Express lo reconoce como manejador de errores por tener cuatro parámetros.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...err.datos });
    return;
  }
  if (err instanceof ZodError) {
    const primero = err.issues[0];
    res.status(400).json({ message: primero?.message ?? 'Datos inválidos', errores: err.issues });
    return;
  }
  if (err instanceof UniqueConstraintError) {
    res.status(409).json({ message: mensajeDuplicado(err) });
    return;
  }
  if (err instanceof ForeignKeyConstraintError) {
    res.status(409).json({ message: 'No se puede completar: hay registros relacionados' });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ message: MENSAJES_SUBIDA[err.code] ?? 'No se pudo procesar el archivo' });
    return;
  }
  if (err instanceof Error && err.message === ERROR_FORMATO_IMAGEN) {
    res.status(400).json({ message: err.message });
    return;
  }

  // body-parser marca los cuerpos ilegibles o demasiado grandes con `type`.
  const tipo = typeof err === 'object' && err !== null && 'type' in err ? err.type : undefined;
  if (tipo === 'entity.parse.failed') {
    res.status(400).json({ message: 'El cuerpo de la solicitud no es JSON válido' });
    return;
  }
  if (tipo === 'entity.too.large') {
    res.status(413).json({ message: 'El contenido enviado es demasiado grande' });
    return;
  }

  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Recurso no encontrado' });
}
