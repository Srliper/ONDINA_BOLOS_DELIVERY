import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

/**
 * Configuração padrão do TanStack Start, sem dependências de plataforma.
 *
 * O Nitro gera a saída em `.output/` e detecta o provedor pelo ambiente de build:
 * Vercel, Netlify e Cloudflare são reconhecidos automaticamente. Fora deles,
 * gera um servidor Node (`node .output/server/index.mjs`).
 * Para forçar um alvo: NITRO_PRESET=vercel | netlify | cloudflare_module | node_server
 */
export default defineConfig({
  server: { port: 3000 },
  plugins: [tsConfigPaths(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
});
