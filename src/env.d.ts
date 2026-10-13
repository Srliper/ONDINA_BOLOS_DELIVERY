/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública do site, ex.: https://ondinabolos.com.br (opcional). */
  readonly VITE_SITE_URL?: string
  /** Webhook do n8n que recebe os pedidos (opcional; há um padrão em src/lib/whatsapp.ts). */
  readonly VITE_N8N_WEBHOOK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
