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
| Fotos reais das camadas               | `public/layers/<id>.png` ou o painel `/admin` |
| Equipe (Administração) e fotos        | `src/data/team.ts`, `src/assets/team/` |
| Instagram da loja                     | `src/lib/site.ts`             |
| Mensagem do pedido e envio ao n8n     | `src/lib/whatsapp.ts`         |
| Checkout (endereço e pagamento)       | `src/lib/checkout.ts`         |

A seção de depoimentos só aparece quando há pelo menos um depoimento real cadastrado.

## Fotos reais das camadas

Cada camada do Monte seu Bolo usa a imagem `public/layers/<id>.png` (PNG com fundo transparente; o
`<id>` está em `src/data/bolo-layers.ts`, ex.: `base-red-velvet.png`). Hoje são ilustrações
provisórias. Para colocar a foto real, escolha um dos dois:

- **Trocar o arquivo:** salve a foto com o **mesmo nome** em `public/layers/` (ex.: substitua
  `base-red-velvet.png`). Vale para o site todo depois de publicar.
- **Pelo painel:** em `/admin` → *Cardápio do site* → *Camadas* ou *Recheios* → *Editar*, cole o
  endereço da foto em *Endereço da imagem*.

Se uma foto cadastrada não carregar, o site volta para a imagem padrão; nunca aparece imagem quebrada.

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

## Pedidos no painel

O painel `/admin` mostra os últimos 50 pedidos lendo do n8n **pelo servidor** (só com login).
No n8n:

1. **Guardar cada pedido** — no fluxo do webhook `pedido-recebido`, adicione um nó *Google Sheets →
   Append row* (ou uma *Data Table* do n8n) com, no mínimo, a coluna `payload` =
   `{{ JSON.stringify($json.body) }}`. Colunas extras (nº, data, nome, total) são opcionais.
2. **Webhook de leitura** — crie outro fluxo: *Webhook* (método **GET**, caminho `pedidos`,
   autenticação **Header Auth** com o nome `x-ondina-key` e uma chave longa) → *Google Sheets → Get
   rows* → *Respond to Webhook* (*All Incoming Items*).
3. **No servidor do site** (Vercel → *Environment Variables*):
   - `N8N_ORDERS_URL` = `https://n8n.ondinabolos.com/webhook/pedidos`
   - `N8N_ORDERS_KEY` = a mesma chave do Header Auth

O painel aceita uma lista com o JSON do pedido direto ou com a coluna `payload` em texto; linhas em
outro formato são ignoradas (e o painel avisa quantas).

## Frete

`src/lib/shipping.ts`: em **São Miguel Arcanjo** a entrega é grátis (R$ 0,00) — o cliente também
pode retirar. Para **qualquer outra cidade**, a única opção é **Retirada no Local**, com o endereço
da loja. O checkout pede a cidade primeiro e o Zod recusa entrega fora de São Miguel Arcanjo.

## Cardápio editável (banco de dados + API)

O painel `/admin` tem a seção **Cardápio do site** para criar, editar e excluir **Bolos** (`Product`),
**Recheios** (`Filling`) e **Camadas** (`Layer`: base, cobertura e decoração), cada um com `price`,
`description` e `image_url`. O site inteiro (cardápio, carrinho, Monte seu Bolo e mensagem do
WhatsApp) usa o que estiver salvo; enquanto ninguém editou, vale o cardápio padrão do código.

API REST (JSON):

| Método | Rota | Quem pode |
| ------ | ---- | --------- |
| GET    | `/api/catalog/{products\|fillings\|layers}` | todos (o site usa) |
| GET    | `/api/catalog/{entidade}/{id}` | todos |
| POST   | `/api/catalog/{entidade}` | equipe logada no `/admin` |
| PUT    | `/api/catalog/{entidade}/{id}` | equipe logada no `/admin` |
| DELETE | `/api/catalog/{entidade}/{id}` | equipe logada no `/admin` |

Escritas exigem a sessão do `/admin`, `Content-Type: application/json` e a mesma origem do site.
Erros de validação voltam com `400` e `issues` por campo. Não dá para apagar a última opção de uma
etapa do Monte seu Bolo (`409`).

**Onde fica guardado:**

- **Site publicado (Vercel):** conecte um banco **Upstash Redis** em *Vercel → Storage →
  Marketplace (Upstash for Redis)* e ligue ao projeto. A Vercel cria `KV_REST_API_URL` e
  `KV_REST_API_TOKEN` sozinha (também aceita `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`).
  Sem isso, o site funciona com o cardápio padrão e o painel avisa que não dá para salvar.
- **No computador:** arquivo `.data/catalog.json` (fora do Git), criado na primeira edição.

## Estoque e pedido pendente

Cada bolo do cardápio tem um **estoque** (em kg para bolos de festa, em bolos para os de café),
marcado pela equipe no `/admin` → *Cardápio do site* → *Bolos* (botões **−**/**+** ou *Editar →
Estoque*). Vazio = sem controle (sempre disponível).

- Estoque **0** (ou pedido acima do estoque): o site mostra **Esgotado**, mas o cliente ainda pode
  deixar o pedido. O checkout **pula a etapa de pagamento** e a mensagem do WhatsApp chega como
  **⏳ PEDIDO PENDENTE**, com pagamento “A combinar”. No n8n, o pedido vai com `status: "pendente"`
  e `payment.method: null`; o painel mostra a etiqueta *Pendente*.
- Para baixar o estoque com um toque, confirme o pedido no painel (abaixo).
- Bolos montados no Monte seu Bolo são sempre sob encomenda (sem estoque).

Regras em `src/lib/stock.ts` (testes em `src/test/stock.test.ts`).

### Confirmar pedido e baixar o estoque

Cada pedido enviado pelo site também fica guardado no banco do site (`POST /api/orders`, além do
n8n; se falhar, o WhatsApp abre do mesmo jeito). Em `/admin` → *Últimos pedidos do site*, o botão
**Confirmar e baixar estoque** tira do estoque os bolos prontos do pedido (nunca abaixo de 0) e
registra quem confirmou; **Desfazer** devolve o estoque. Ficam guardados os últimos 300 pedidos
(Upstash: lista `ondina:orders` e hash `ondina:orders:confirmed`; no computador, `.data/orders.json`).
Sem banco configurado, o painel volta a mostrar a lista do n8n, só para consulta.

### Aviso de bolo esgotado no WhatsApp

Quando um bolo chega a 0 (pelo − ou ao confirmar um pedido), o painel mostra **Esgotou** com o botão
**Avisar no WhatsApp**, que abre a conversa com o número da loja e a mensagem pronta. A faixa
*Esgotados agora* no cardápio tem o mesmo atalho.

Aviso automático (opcional): crie no n8n um fluxo *Webhook (POST)* → nó do WhatsApp que envia
`{{ $json.body.message }}` para o número da loja, e configure na Vercel `N8N_STOCK_ALERT_URL` com o
endereço desse webhook. O site manda `{ event: "estoque-esgotado", products, message, by }` com o
cabeçalho `x-ondina-key` = `N8N_ORDERS_KEY`. Se o n8n falhar, o estoque é salvo do mesmo jeito.

## Fotos pelo painel

No formulário de bolos, recheios e camadas, **Enviar foto do celular ou computador** reduz a foto no
navegador (`src/lib/image-resize.ts`) e envia para `POST /api/images` (só equipe logada). A foto fica
no mesmo banco do cardápio (Upstash, ou `.data/images/` no computador) e é servida em
`/api/images/<id>`, que vira o `image_url` do item. Aceita JPEG, PNG e WebP de até 1 MB (os bytes são
conferidos; SVG não é aceito).

## Tutorial do painel

O próprio `/admin` tem o **Tutorial do painel** (`src/components/admin/AdminTutorial.tsx`) com o passo a
passo de entrar, marcar estoque, pedidos pendentes, mudar preços, adicionar bolos com foto e
acompanhar os pedidos. A tela de entrada tem o atalho “Como entrar?”.
