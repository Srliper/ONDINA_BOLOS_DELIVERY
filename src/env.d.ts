/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública do site, ex.: https://ondinabolos.com.br (opcional). */
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
