/** Alvo da animação: o botão do carrinho no topo da página. */
export const CART_TARGET_ID = 'cart-button'

const prefersReducedMotion = () =>
  typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Faz uma cópia da foto do bolo "voar" em arco até o carrinho e resolve quando ela chega.
 * Usa só a Web Animations API. Sem alvo visível ou com "reduzir movimento", resolve na hora.
 */
export function flyToCart(source: HTMLElement | null): Promise<void> {
  const target = document.getElementById(CART_TARGET_ID)
  if (!source || !target || prefersReducedMotion() || typeof source.animate !== 'function') {
    return Promise.resolve()
  }

  const from = source.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (from.width === 0 || to.width === 0) return Promise.resolve()

  const size = Math.min(from.width, from.height, 160)
  const startX = from.left + from.width / 2 - size / 2
  const startY = from.top + from.height / 2 - size / 2
  const dx = to.left + to.width / 2 - (startX + size / 2)
  const dy = to.top + to.height / 2 - (startY + size / 2)
  const lift = Math.min(160, Math.abs(dy) * 0.35 + 60)

  const ghost = source.cloneNode(true) as HTMLElement
  ghost.removeAttribute('id')
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    margin: '0',
    objectFit: 'cover',
    borderRadius: '50%',
    zIndex: '60',
    pointerEvents: 'none',
    boxShadow: '0 18px 40px oklch(0.301 0.064 43 / 25%)',
    willChange: 'transform, opacity',
  })
  document.body.appendChild(ghost)

  // Arco: sobe um pouco, depois mergulha encolhendo até o ícone do carrinho.
  const flight = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - lift}px) scale(.62)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.6, offset: 1 },
    ],
    { duration: 780, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' },
  )

  return flight.finished
    .catch(() => undefined)
    .then(() => {
      ghost.remove()
      target.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-8deg)' }, { transform: 'scale(1)' }],
        { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' },
      )
    })
}
