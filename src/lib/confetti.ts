/** Rosa pastel e dourado da marca. */
export const BRAND_CONFETTI_COLORS = ['#F6B8C8', '#F9D5DE', '#E8A0B4', '#D9B25F', '#F1D38A']

/**
 * Chuva de confete nas cores da Ondina. A biblioteca é carregada só no clique
 * (fica fora do bundle inicial e nunca roda no servidor) e não dispara com
 * "reduzir movimento" ativo.
 */
export async function celebrate(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const { default: confetti } = await import('canvas-confetti')
    const shared = {
      colors: BRAND_CONFETTI_COLORS,
      disableForReducedMotion: true,
      zIndex: 80,
      ticks: 220,
    }
    void confetti({ ...shared, particleCount: 90, spread: 75, startVelocity: 42, origin: { x: 0.5, y: 0.65 } })
    void confetti({ ...shared, particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.75 } })
    void confetti({ ...shared, particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.75 } })
  } catch {
    // Confete é enfeite: se falhar ao carregar, o fluxo continua normalmente.
  }
}
