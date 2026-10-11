# Ondina Bolos

Site de delivery da Ondina Bolos, confeitaria em São Miguel Arcanjo (SP). O cliente escolhe os bolos, monta o carrinho e envia o pedido pronto pelo WhatsApp.

Feito com TanStack Start (React 19), Tailwind CSS 4, Radix UI e Sonner. Não depende do Lovable nem de nenhuma plataforma específica.

## Rodar no computador

Precisa de [Bun](https://bun.sh) (ou Node 22.12+ com npm).

```bash
bun install
bun run dev        # http://localhost:3000
```

| Comando             | O que faz                                  |
| ------------------- | ------------------------------------------ |
| `bun run dev`       | Servidor de desenvolvimento                |
| `bun run build`     | Gera a versão de produção em `.output/`    |
| `bun run start`     | Roda a versão de produção (Node)           |
| `bun run test`      | Testes (mensagem do WhatsApp e carrinho)   |
| `bun run typecheck` | Checagem de tipos do TypeScript            |

## Publicar (deploy)

O build usa o [Nitro](https://nitro.build), que detecta o provedor automaticamente. Em todos os casos, configure a variável opcional `VITE_SITE_URL` com o endereço final do site (ex.: `https://ondinabolos.com.br`) para o Google e as prévias de link no WhatsApp/Instagram ficarem completas.

### Vercel (recomendado)

1. Suba este projeto para um repositório no GitHub.
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório. O framework é detectado sozinho; não precisa mudar nada.
3. Em *Settings → Environment Variables*, adicione `VITE_SITE_URL`.
4. Cada `git push` na branch `main` publica uma nova versão.

### Netlify

Importe o repositório em [app.netlify.com](https://app.netlify.com). Comando de build: `bun run build`. O Nitro gera a saída no formato da Netlify sozinho.

### Cloudflare

Use `NITRO_PRESET=cloudflare_module bun run build` e publique com `npx wrangler deploy`.

### VPS, Railway, Render ou Fly.io (Docker)

```bash
docker build -t ondina-bolos .
docker run -p 3000:3000 ondina-bolos
```

Sem Docker: `NITRO_PRESET=node_server bun run build && bun run start`.

## Onde mudar as coisas

| O quê                                 | Arquivo                       |
| ------------------------------------- | ----------------------------- |
| Bolos com foto, preços e descrições   | `src/data/products.ts`        |
| Lista completa de sabores             | `src/lib/bakery-menu.ts`      |
| Número do WhatsApp e texto do pedido  | `src/lib/whatsapp.ts`         |
| Endereço, telefone e horários         | `src/lib/site.ts`             |
| Depoimentos de clientes (reais)       | `src/data/testimonials.ts`    |
| Cores, fontes e animações             | `src/styles.css`              |
| Logo                                  | `src/assets/ondina_logo.png`  |
| Camadas do Monte seu Bolo e preços    | `src/data/bolo-layers.ts`     |
| Fotos reais das camadas               | `public/layers/foto-real-<id>.png` |
| Equipe (Administração) e fotos        | `src/data/team.ts`, `src/assets/team/` |
| Instagram da loja                     | `src/lib/site.ts`             |
| Mensagem do pedido e envio ao n8n     | `src/lib/whatsapp.ts`         |
| Checkout (endereço e pagamento)       | `src/lib/checkout.ts`         |

A seção de depoimentos só aparece quando há pelo menos um depoimento real cadastrado.

## Fotos reais das camadas

Cada camada do Monte seu Bolo procura a foto `public/layers/foto-real-<id>.png` (PNG com fundo
transparente; o `<id>` está em `src/data/bolo-layers.ts`, ex.: `foto-real-base-red-velvet.png`).
Enquanto a foto não existe, aparece a ilustração provisória `public/layers/<id>.png`.

## n8n

Ao enviar o pedido, o site faz um `POST` em JSON para o webhook do n8n e depois abre o WhatsApp.
Se o n8n falhar ou demorar mais de 2,5 s, o WhatsApp abre do mesmo jeito. Configure:

- `VITE_N8N_WEBHOOK_URL` (opcional; o padrão é `https://n8n.ondinabolos.com/webhook/pedido-recebido`);
- no nó Webhook do n8n, **Options → Allowed Origins (CORS)** com o endereço do site.

## Área da equipe (`/admin`)

Entrada com senha para a família (Ondina, Edgard e Kaique), com atalhos para o WhatsApp da
empresa, o n8n, o Instagram e a tabela de preços. A senha **não fica no código**: configure a
variável `ADMIN_PASSWORD` no provedor (na Vercel: *Settings → Environment Variables*) e, no
computador, num arquivo `.env` (que não vai para o GitHub). Sem a variável, ninguém entra.
Cinco senhas erradas seguidas bloqueiam o acesso por 5 minutos.
