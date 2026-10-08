/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** URL base de la API, por ejemplo https://mi-backend.onrender.com/api */
  readonly VITE_API_BASE_URL?: string;
  /** Credenciales del taller de demostración pública. Sin ellas, el login no muestra la demo. */
  readonly VITE_DEMO_EMAIL?: string;
  readonly VITE_DEMO_PASSWORD?: string;
  /** Dominio donde viven las páginas legales (el landing). */
  readonly VITE_LEGAL_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
