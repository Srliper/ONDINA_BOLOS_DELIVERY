import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StackedCake } from '@/components/StackedCake'
import type { LayerVisual } from '@/lib/layer-photo'

const layer = (id: string): LayerVisual => ({
  category: 'base',
  image: `/layers/foto-real-${id}.png`,
  fallbackImage: `/layers/${id}.png`,
  offsetY: 0,
})

afterEach(() => vi.restoreAllMocks())

describe('foto real com ilustração provisória', () => {
  it('troca para a ilustração quando a foto real não carrega', () => {
    const { container } = render(<StackedCake layers={[layer('teste-erro')]} width={100} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/layers/foto-real-teste-erro.png')
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('/layers/teste-erro.png')
  })

  it('também troca quando a foto já tinha falhado antes de o React assumir (página vinda do servidor)', () => {
    // Imagem "quebrada" desde o início: completa e sem largura.
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0)
    const { container } = render(<StackedCake layers={[layer('teste-ssr')]} width={100} />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/layers/teste-ssr.png')
  })
})
