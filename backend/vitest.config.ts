import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Valores de prueba para que `config/env` valide sin un .env real.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'secreto-de-prueba',
      ENCRYPTION_KEY: '0'.repeat(63) + '1',
      APP_TIMEZONE: 'America/Argentina/Buenos_Aires'
    }
  }
});
