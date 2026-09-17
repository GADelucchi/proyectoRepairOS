import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

export class HttpError extends Error {
  public status: number;
  /**
   * Datos que la pantalla necesita para reaccionar al error, no solo mostrarlo.
   * Ejemplo: un rechazo por falta de cuenta corriente viaja con
   * `requiereAutorizacion`, y con eso el frontend ofrece pedirle permiso a un
   * supervisor en vez de dejar al mostrador sin salida.
   */
  public datos?: Record<string, unknown>;

  constructor(status: number, message: string, datos?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.datos = datos;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ message: 'Datos inválidos', errores: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...(err.datos ?? {}) });
    return;
  }

  // Los errores de subida son culpa del pedido, no del servidor.
  if (err instanceof multer.MulterError) {
    const mensajes: Record<string, string> = {
      LIMIT_FILE_SIZE: 'La imagen supera el tamaño máximo de 10 MB',
      LIMIT_FILE_COUNT: 'Se pueden subir hasta 10 imágenes por vez',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado'
    };
    res.status(400).json({ message: mensajes[err.code] ?? 'No se pudo procesar el archivo' });
    return;
  }

  if (err instanceof Error && err.message.startsWith('Formato de imagen no soportado')) {
    res.status(400).json({ message: err.message });
    return;
  }

  // body-parser marca los cuerpos ilegibles con `type` y un status propio:
  // son pedidos mal formados, no fallas del servidor.
  if (err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'El cuerpo de la solicitud no es JSON válido' });
    return;
  }

  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large') {
    res.status(413).json({ message: 'El contenido enviado es demasiado grande' });
    return;
  }
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ message: 'Recurso no encontrado' });
}
