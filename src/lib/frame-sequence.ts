/**
 * Contas puras da intro com sequência de frames (src/components/ScrollIntro.tsx):
 * quais frames usar, em que ordem baixar e como encaixar cada um na tela.
 */

export const INTRO_FRAME_COUNT = 240
/** Frame mostrado parado com "reduzir movimento" (o bolo inteiro). */
export const INTRO_STATIC_FRAME = 96

export const introFramePath = (n: number) => `/intro/frames/frame-${String(n).padStart(4, '0')}.webp`

/** Números dos frames em uso, de `step` em `step`; o último sempre entra. */
export function frameNumbers(count: number, step: number): number[] {
  const numbers: number[] = []
  for (let n = 1; n <= count; n += step) numbers.push(n)
  if (numbers[numbers.length - 1] !== count) numbers.push(count)
  return numbers
}

/**
 * Ordem de download (índices): o primeiro, depois 1 a cada 10 (já dá para rolar, com saltos)
 * e por fim os que faltam.
 */
export function preloadOrder(length: number): number[] {
  const order = [0]
  const seen = new Set(order)
  for (const stride of [10, 1])
    for (let i = 0; i < length; i += stride)
      if (!seen.has(i)) {
        seen.add(i)
        order.push(i)
      }
  return order
}

/** Item carregado mais próximo de `i` (enquanto o resto ainda baixa); null se nenhum. */
export function nearestLoaded<T>(items: readonly (T | null)[], i: number): T | null {
  for (let d = 0; d < items.length; d++) {
    const before = items[i - d]
    if (before) return before
    const after = items[i + d]
    if (after) return after
  }
  return null
}

export type FitMode = 'cover' | 'contain'

/** [x, y, largura, altura] para desenhar a imagem preservando a proporção. */
export function fitRect(iw: number, ih: number, cw: number, ch: number, mode: FitMode): [number, number, number, number] {
  const scale = mode === 'cover' ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih)
  const w = iw * scale
  const h = ih * scale
  return [(cw - w) / 2, (ch - h) / 2, w, h]
}

/**
 * Cobrir a tela cortaria demais (ex.: frame vertical num monitor largo)?
 * Nesse caso a imagem aparece inteira, com o mesmo frame desfocado de fundo.
 */
export function shouldContain(iw: number, ih: number, cw: number, ch: number, minVisible = 0.7): boolean {
  const scale = Math.max(cw / iw, ch / ih)
  return (cw * ch) / (iw * ih * scale * scale) < minVisible
}

/** 0–1: quanto da seção alta já rolou enquanto o palco fica preso. */
export function scrollProgress(sectionTop: number, sectionHeight: number, stageHeight: number): number {
  const distance = sectionHeight - stageHeight
  if (distance <= 0) return 0
  return Math.min(1, Math.max(0, -sectionTop / distance))
}
