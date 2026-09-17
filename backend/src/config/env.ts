import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    name: required('DB_NAME', 'repairos'),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? ''
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h'
  },

  encryptionKey: required('ENCRYPTION_KEY'),

  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    local: {
      uploadsDir: process.env.LOCAL_UPLOADS_DIR ?? 'uploads',
      publicUrl: process.env.LOCAL_PUBLIC_URL ?? 'http://localhost:4000/uploads'
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? undefined,
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      publicUrl: process.env.S3_PUBLIC_URL ?? '',
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'false') === 'true'
    }
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'RepairOS <no-reply@example.com>'
  },

  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER ?? 'none',
    apiKey: process.env.WHATSAPP_API_KEY ?? ''
  }
};
