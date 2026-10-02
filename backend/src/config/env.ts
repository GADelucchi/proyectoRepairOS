import 'dotenv/config';
import { z } from 'zod';

/**
 * Configuración del proceso, validada una sola vez al arrancar.
 *
 * Si falta una variable obligatoria o tiene un formato inválido, el servidor no
 * levanta y el error dice exactamente cuál: es mejor fallar acá que cifrar con
 * una clave rota o firmar tokens con un secreto vacío.
 */

const booleano = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const listaSeparadaPorComas = z
  .string()
  .default('http://localhost:5173,http://localhost:5174')
  .transform((v) =>
    v
      .split(',')
      .map((origen) => origen.trim())
      .filter(Boolean)
  );

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Zona horaria del negocio: define qué es "hoy" en la caja y las horas del remito. */
  APP_TIMEZONE: z.string().default('America/Argentina/Buenos_Aires'),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('repairos'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET es obligatoria'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY debe ser hexadecimal de 64 caracteres (32 bytes)'),

  CORS_ALLOWED_ORIGINS: listaSeparadaPorComas,

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_UPLOADS_DIR: z.string().default('uploads'),
  LOCAL_PUBLIC_URL: z.string().default('http://localhost:4000/uploads'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_PUBLIC_URL: z.string().default(''),
  S3_FORCE_PATH_STYLE: booleano,

  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('RepairOS <no-reply@example.com>'),

  WHATSAPP_PROVIDER: z.string().default('none'),
  WHATSAPP_API_KEY: z.string().default('')
});

function cargarEntorno() {
  // Las variables vacías del .env (`S3_ENDPOINT=`) se tratan como ausentes, así
  // toman su valor por defecto en vez de pasar como cadena vacía.
  const definidas = Object.fromEntries(Object.entries(process.env).filter(([, valor]) => valor !== ''));
  const resultado = esquema.safeParse(definidas);

  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida en el .env:\n${detalle}`);
  }
  return resultado.data;
}

const e = cargarEntorno();

export const env = {
  nodeEnv: e.NODE_ENV,
  esProduccion: e.NODE_ENV === 'production',
  port: e.PORT,
  timezone: e.APP_TIMEZONE,

  db: {
    host: e.DB_HOST,
    port: e.DB_PORT,
    name: e.DB_NAME,
    user: e.DB_USER,
    password: e.DB_PASSWORD
  },

  jwt: {
    secret: e.JWT_SECRET,
    expiresIn: e.JWT_EXPIRES_IN
  },

  encryptionKey: e.ENCRYPTION_KEY,
  corsAllowedOrigins: e.CORS_ALLOWED_ORIGINS,

  storage: {
    driver: e.STORAGE_DRIVER,
    local: {
      uploadsDir: e.LOCAL_UPLOADS_DIR,
      publicUrl: e.LOCAL_PUBLIC_URL
    },
    s3: {
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      bucket: e.S3_BUCKET,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      publicUrl: e.S3_PUBLIC_URL,
      forcePathStyle: e.S3_FORCE_PATH_STYLE
    }
  },

  email: {
    resendApiKey: e.RESEND_API_KEY,
    from: e.EMAIL_FROM
  },

  whatsapp: {
    provider: e.WHATSAPP_PROVIDER,
    apiKey: e.WHATSAPP_API_KEY
  }
} as const;
