# Ondina Bolos — notas para quem mexer no código

- O cardápio fica na rota inicial (`src/routes/index.tsx`). O pedido é montado no carrinho, passa pelo checkout (endereço, forma de pagamento, resumo) e é finalizado numa conversa de WhatsApp; não há cobrança no site (o QR Code do Pix é só ilustrativo).
- Produtos com foto: `src/data/products.ts`. Sabores completos do cardápio: `src/lib/bakery-menu.ts`. Preços sempre como número, formatados com `formatBRL` (`src/lib/format.ts`).
- Formato da mensagem do pedido: `src/lib/whatsapp.ts` (coberto por `src/test/whatsapp.test.ts`). `processOrderAndSend` registra o pedido no webhook do n8n (`VITE_N8N_WEBHOOK_URL`, com tempo limite e erro silencioso) e sempre abre o WhatsApp depois — o n8n nunca pode impedir o pedido.
- Checkout em etapas: `src/components/CheckoutStepper.tsx`; regras e validação (Zod) em `src/lib/checkout.ts`.
- Visual centralizado em `src/styles.css`; variantes de botão em `src/components/ui/button.tsx`.
- Movimento: CSS + `src/components/MotionRoot.tsx` + `src/lib/fly-to-cart.ts` no site; Framer Motion só nas telas imersivas (Monte seu Bolo em camadas em `src/components/BoloBuilder.tsx`, sempre dentro de `<MotionConfig reducedMotion="user">`). Confete só via `celebrate()` em `src/lib/confetti.ts`. Toda animação precisa respeitar `prefers-reduced-motion`.
- Camadas do Monte seu Bolo: `src/data/bolo-layers.ts`. Cada camada usa `public/layers/<id>.png` (hoje ilustração provisória; a foto real entra trocando o arquivo ou pelo `image_url` no painel). `useLayerSrc` (`src/lib/layer-photo.ts`) tenta a imagem, depois a padrão, e some se as duas falharem — nunca mostrar imagem quebrada. O 3D é só CSS (perspective + preserve-3d + translateZ), sem bibliotecas 3D.
- Use as fotos reais dos bolos. Depoimentos só reais, em `src/data/testimonials.ts`.
- Administração em `/admin` (`src/routes/admin.tsx`): senha só na variável de ambiente `ADMIN_PASSWORD` (nunca no código), conferida no servidor por server functions em `src/lib/admin-auth.ts`; sessão em cookie httpOnly assinado (`src/lib/admin-session.ts`). Não coloque dados de clientes nem senhas no bundle do navegador.
- WhatsApp flutuante para clientes: `src/components/WhatsAppWidget.tsx`.
- Pedidos no painel: `src/lib/orders.ts` (leitura tolerante do n8n) + `getAdminOrders` em `src/lib/admin-auth.ts`, que exige sessão e usa `N8N_ORDERS_URL`/`N8N_ORDERS_KEY` só no servidor.
- Frete: `src/lib/shipping.ts` (grátis só em São Miguel Arcanjo; fora dela, só Retirada no Local).
- Cardápio editável: entidades e CRUD puro em `src/lib/catalog.ts`; banco em `src/lib/catalog-store.ts` (Upstash Redis pela REST ou `.data/catalog.json`); API REST em `src/routes/api/catalog.*` com regras em `src/lib/catalog-api.ts`; a rota raiz carrega o catálogo e chama `applyCatalog` antes de desenhar — `products`/`BOLO_LAYERS` são a lista em uso, `DEFAULT_*` o padrão. Código que só roda no servidor fica em `*.server.ts` ou `createServerOnlyFn`.

- Estoque: `stock` dos bolos (kg ou unidades; `null` = sem controle) em `src/lib/catalog.ts`; regras em `src/lib/stock.ts`. Faltou estoque → o checkout pula o pagamento (`payment: null`) e o pedido vai como PENDENTE no WhatsApp e no n8n (`status: "pendente"`).
- Fotos enviadas pelo painel: `src/lib/image-api.ts` (`/api/images`, só JPEG/PNG/WebP conferidos pelos bytes) + `src/lib/image-resize.ts` no navegador. Tutorial do painel: `src/components/admin/AdminTutorial.tsx` — atualize-o quando mudar o painel.
