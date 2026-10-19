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

Cada pedido finalizado no site é **registrado no banco do próprio site** (o mesmo do cardápio:
Upstash Redis na Vercel, ou `.data/orders-v2.json` no computador) antes de abrir o WhatsApp ou o
pagamento online. O servidor
recalcula os preços pelo catálogo e confere o estoque:

| Situação ao finalizar | Status do pedido | Estoque |
| --- | --- | --- |
| Tudo em estoque (ou bolo sem controle / montado) | **Aguardando pagamento** | baixa na hora |
| Faltou algum bolo | **PENDENTE (Falta de estoque)** | não mexe |

No `/admin`, em **Pedidos do site**, a equipe vê cliente, endereço com CEP, itens e total, e muda o
**status da entrega**: Aguardando pagamento → Pago / Em preparo → Saiu para entrega (ou Pronto para
retirada) → Entregue, ou Cancelado (devolve o estoque reservado). **Confirmar pagamento** marca como
pago e manda para o preparo. Pix só vai para o preparo depois de pago; dinheiro e cartão são pagos
na entrega/retirada.

Pedido **PENDENTE** fica bloqueado: o servidor recusa qualquer avanço (seletor ou pagamento). Ele
só sai dali com **Verificar estoque**, depois de a equipe dar entrada no estoque — aí o estoque é
reservado e o pedido vai para Aguardando pagamento.

Se o registro falhar (banco fora do ar), o cliente segue normalmente pelo WhatsApp e pelo n8n — o
pedido nunca se perde. O webhook do n8n (`VITE_N8N_WEBHOOK_URL`) continua recebendo cada pedido,
com o mesmo número **OB-…** do painel.

## Comprar pelo site ou pelo WhatsApp

Na etapa **Pagamento** do checkout, o cliente escolhe onde finalizar:

- **Pagar aqui no site** — Pix ou cartão na página segura do **Mercado Pago** (Checkout Pro). O
  pedido é registrado, o cliente paga e volta para a **página do pedido** (`/pedido/<id>?t=<chave>`),
  onde acompanha o status e **conversa com a loja**. O pagamento aprovado é conferido direto na API
  do Mercado Pago (nunca pelo navegador) e o pedido vai sozinho para **Pago / Em preparo**. Pedido
  pendente (sem estoque) não é cobrado: o botão **Pagar agora** aparece na página do pedido quando a
  equipe libera o estoque.
- **Finalizar pelo WhatsApp** — como antes: Pix, cartão ou dinheiro combinados na conversa. A
  mensagem agora leva o link da página do pedido, para o cliente acompanhar e falar pelo site também.

O checkout também pede o **WhatsApp do cliente**, que aparece no painel para a equipe entrar em
contato.

**Configurar o Mercado Pago** (sem isso, o checkout mostra só o WhatsApp):

1. Em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers) → *Suas
   integrações* → crie uma aplicação (Checkout Pro) e copie o **Access Token** de produção
   (`APP_USR-…`). Para testar sem cobrar, use o de teste (`TEST-…`).
2. Na Vercel, adicione `MERCADOPAGO_ACCESS_TOKEN` (e `VITE_SITE_URL` com o endereço do site).
3. Opcional, mas recomendado: em *Webhooks*, cadastre `https://<seu-site>/api/payments/webhook`
   com o evento **Pagamentos** e copie a **assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET`.
   (O site já informa esse endereço em cada pagamento; a assinatura confere que a notificação veio
   do Mercado Pago.)

O dinheiro cai na conta do Mercado Pago da loja. Se um pedido pago online for cancelado, devolva o
valor pelo painel do Mercado Pago (o histórico do pedido avisa). Código: `src/lib/payment-gateway.ts`
(API do Mercado Pago), `src/lib/payment-webhook.server.ts` (notificações), `src/lib/site-order.ts`
(navegador) e `src/components/OrderTracking.tsx` (página do pedido).

**Banco de dados:** pedidos, conversas e avisos ficam no mesmo **Upstash Redis** do cardápio — um
banco online, sem servidor para manter ligado, que cobra por uso (o plano grátis cobre uma
confeitaria com folga). Nada roda no computador da loja.

## Avisos para a equipe

- **Celular, mesmo com o painel fechado (push):** gere as chaves com `bunx web-push generate-vapid-keys`
  e configure `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` na Vercel. No `/admin`, cada pessoa toca em
  **Ligar notificações** no próprio celular. Pedido novo (site ou WhatsApp), pagamento aprovado,
  mensagem de cliente, "avise-me" e bolo esgotado chegam como notificação do aparelho. No **iPhone**,
  antes abra o `/admin` no Safari → *Compartilhar* → **Adicionar à Tela de Início** e ligue por lá
  (exigência da Apple). Aparelhos inscritos ficam em `ondina:push-subs`.
- **Painel aberto** (celular ou computador): o quadro **Avisos** no `/admin` confere a cada 30 s e
  toca um aviso quando chega pedido novo, pagamento aprovado (**pedido para entregar**), mensagem de
  cliente ou pedido de "avise-me". Com **Ligar notificações**, o aparelho mostra a notificação mesmo
  com outra aba na frente; o título da aba mostra quantas coisas precisam de atenção.
- **Painel fechado** (opcional): configure `N8N_STORE_ALERT_URL` com um webhook do n8n (*Webhook
  POST* → nó do WhatsApp enviando `{{ $json.body.message }}` para o número da loja). O site manda
  `{ event, orderId, customer, total, message, … }` com `x-ondina-key` = `N8N_ORDERS_KEY`, nos eventos
  `pedido-novo` (pelo site), `pagamento-aprovado`, `mensagem-cliente` e `aviso-estoque`. Falha do
  n8n nunca impede o pedido.

## Prazo para pagar, trava de estoque e limites

- **Pedido pago no site tem 2 horas para ser pago** (contadas de quando ele fica "Aguardando
  pagamento"). O link do Mercado Pago vence junto. Sem pagamento, 15 minutos depois do prazo o
  pedido é cancelado sozinho e o estoque reservado volta — a conferência roda sempre que alguém
  abre o painel, a página de um pedido ou faz um pedido novo (não precisa de tarefa agendada).
- **Dois clientes nunca levam o mesmo último bolo**, mesmo com várias cópias do site no ar: toda
  gravação de pedidos, estoque e cardápio passa por uma trava no Upstash (`ondina:lock:write`,
  expira sozinha em 15 s). Código: `src/lib/redis-guard.server.ts`.
- **Limite contra abuso** por IP (pedidos, mensagens, avise-me) contado no Upstash, valendo para
  todas as cópias do site.

## Data e horário, relatório e "Meus pedidos"

- O checkout pede **para quando**: data (até 60 dias, domingo fechado) e faixa — manhã (8h–12h),
  tarde (12h–18h) ou noite (18h–20h, só sábado). Aparece no resumo, no painel, na página do pedido,
  na mensagem do WhatsApp e no n8n (`schedule`). Regras em `src/lib/checkout.ts`.
- **Vendas** no `/admin`: vendido (pago), pedidos, ticket médio, a receber, vendas por dia, site ×
  WhatsApp e os bolos que mais venderam, em 7, 30 ou 90 dias (`src/lib/sales-report.ts`).
- **Meus pedidos** no topo do site: os últimos 5 pedidos feitos no aparelho, com o link de cada um.

## Bolo esgotado: "Avise-me quando chegar"

Com estoque **0**, o cartão do bolo mostra **Avise-me quando chegar**: o cliente deixa nome,
WhatsApp e (opcional) quanto quer. No `/admin`, **Procura por bolos esgotados** mostra, por bolo,
quantas pessoas esperam, os pedidos pendentes e a quantidade procurada — a demanda do que está em
falta. Quando o estoque volta, o bolo aparece como **Voltou**; tocar no telefone do cliente abre o
WhatsApp com a mensagem pronta, e o ✓ marca como avisado. Guardado em `ondina:stock-requests` (ou
`.data/stock-requests.json`); regras em `src/lib/stock-requests.ts`.

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
  deixar o pedido. Ele escolhe a forma de pagamento normalmente, mas o pedido é criado como
  **PENDENTE (Falta de estoque)** e a mensagem do WhatsApp chega como **⏳ PEDIDO PENDENTE** — nada
  é cobrado antes da confirmação do estoque. No n8n, o pedido vai com `status: "pendente"`.
- O estoque baixa sozinho quando um pedido do site é feito com tudo disponível (veja *Pedidos no painel*).
- Bolos montados no Monte seu Bolo são sempre sob encomenda (sem estoque).

Regras em `src/lib/stock.ts` (testes em `src/test/stock.test.ts`).

### Pedidos antigos

Os pedidos guardados pela versão anterior do painel (Upstash: lista `ondina:orders` e hash
`ondina:orders:confirmed`; no computador, `.data/orders.json`) continuam aparecendo em
*Pedidos do site* → **Pedidos antigos**, só para consulta. Os pedidos novos ficam em
`ondina:orders:v2` (ou `.data/orders-v2.json`), no fluxo com status descrito em *Pedidos no painel*.

### Aviso de bolo esgotado no WhatsApp

Quando um bolo chega a 0 (pelo − no painel ou quando um pedido do site leva o último), o painel mostra **Esgotou** com o botão
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
