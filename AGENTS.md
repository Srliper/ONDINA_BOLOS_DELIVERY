# Ondina Bolos — notas para quem mexer no código

- O cardápio fica na rota inicial (`src/routes/index.tsx`). O pedido é montado no carrinho e finalizado numa conversa de WhatsApp; não há pagamento no site.
- Produtos com foto: `src/data/products.ts`. Sabores completos do cardápio: `src/lib/bakery-menu.ts`. Preços sempre como número, formatados com `formatBRL` (`src/lib/format.ts`).
- Formato da mensagem do pedido: `src/lib/whatsapp.ts` (coberto por `src/test/whatsapp.test.ts`).
- Visual centralizado em `src/styles.css`; variantes de botão em `src/components/ui/button.tsx`.
- Movimento: CSS + `src/components/MotionRoot.tsx` + `src/lib/fly-to-cart.ts` no site; Framer Motion só nas telas imersivas (Monte seu Bolo em camadas em `src/components/BoloBuilder.tsx`, sempre dentro de `<MotionConfig reducedMotion="user">`). Confete só via `celebrate()` em `src/lib/confetti.ts`. Toda animação precisa respeitar `prefers-reduced-motion`.
- Camadas do Monte seu Bolo: `src/data/bolo-layers.ts`. Cada camada usa a foto real `public/layers/foto-real-<id>.png` (PNG transparente); enquanto ela não existir, `useLayerSrc` (`src/lib/layer-photo.ts`) mostra a ilustração provisória `public/layers/<id>.png`. O 3D é só CSS (perspective + preserve-3d + translateZ), sem bibliotecas 3D.
- Use as fotos reais dos bolos. Depoimentos só reais, em `src/data/testimonials.ts`.
