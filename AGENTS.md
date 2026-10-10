# Ondina Bolos — notas para quem mexer no código

- O cardápio fica na rota inicial (`src/routes/index.tsx`). O pedido é montado no carrinho e finalizado numa conversa de WhatsApp; não há pagamento no site.
- Produtos com foto: `src/data/products.ts`. Sabores completos do cardápio: `src/lib/bakery-menu.ts`. Preços sempre como número, formatados com `formatBRL` (`src/lib/format.ts`).
- Formato da mensagem do pedido: `src/lib/whatsapp.ts` (coberto por `src/test/whatsapp.test.ts`).
- Visual centralizado em `src/styles.css`; variantes de botão em `src/components/ui/button.tsx`.
- Movimento: só CSS + `src/components/MotionRoot.tsx` + `src/lib/fly-to-cart.ts`. Toda animação precisa respeitar `prefers-reduced-motion`.
- Use as fotos reais dos bolos. Depoimentos só reais, em `src/data/testimonials.ts`.
