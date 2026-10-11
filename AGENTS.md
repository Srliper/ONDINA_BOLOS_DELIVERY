# Ondina Bolos — notas para quem mexer no código

- O cardápio fica na rota inicial (`src/routes/index.tsx`). O pedido é montado no carrinho e finalizado numa conversa de WhatsApp; não há pagamento no site.
- Produtos com foto: `src/data/products.ts`. Sabores completos do cardápio: `src/lib/bakery-menu.ts`. Preços sempre como número, formatados com `formatBRL` (`src/lib/format.ts`).
- Formato da mensagem do pedido: `src/lib/whatsapp.ts` (coberto por `src/test/whatsapp.test.ts`).
- Visual centralizado em `src/styles.css`; variantes de botão em `src/components/ui/button.tsx`.
- Movimento: CSS + `src/components/MotionRoot.tsx` + `src/lib/fly-to-cart.ts` no site; Framer Motion só nas telas imersivas (Monte seu Bolo em camadas em `src/components/BoloBuilder.tsx`, sempre dentro de `<MotionConfig reducedMotion="user">`). Confete só via `celebrate()` em `src/lib/confetti.ts`. Toda animação precisa respeitar `prefers-reduced-motion`.
- Camadas do Monte seu Bolo: `src/data/bolo-layers.ts` (imagens provisórias em `public/layers/`, substituir por fotos reais).
- Use as fotos reais dos bolos. Depoimentos só reais, em `src/data/testimonials.ts`.
