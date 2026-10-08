import { defineConfig } from 'vitest/config';
import { BASE_DE_TESTS } from './src/test/integracion/base';

/**
 * Tests de integración: la API completa contra una base MySQL real
 * (`repairos_test`, que se borra y se vuelve a migrar en cada corrida).
 * Usan el servidor y el usuario de MySQL del `.env`.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/test/integracion/preparar-base.ts'],
    // Una sola base compartida: los archivos corren de a uno.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DB_NAME: BASE_DE_TESTS,
      JWT_SECRET: 'secreto-de-prueba',
      ENCRYPTION_KEY: '0'.repeat(63) + '1',
      APP_TIMEZONE: 'America/Argentina/Buenos_Aires',
      APP_PUBLIC_URL: 'https://app.ejemplo.test',
      PLATFORM_ADMIN_EMAILS: 'plataforma@test.local',
      SOPORTE_EMAIL: 'soporte@test.local',
      SOPORTE_WHATSAPP: '5491100000000',
      RESEND_API_KEY: '',
      EXIGIR_EMAIL_VERIFICADO: 'false'
    }
  }
});
