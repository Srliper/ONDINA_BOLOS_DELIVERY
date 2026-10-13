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

describe('imagem da camada com reserva', () => {
  it('troca para a imagem padrão quando a foto cadastrada não carrega', () => {
    const { container } = render(<StackedCake layers={[layer('teste-erro')]} width={100} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/layers/foto-real-teste-erro.png')
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('/layers/teste-erro.png')
  })

  it('também troca quando a foto já tinha falhado antes de o React assumir (página vinda do servidor)', () => {
    // Só a primeira imagem chegou "quebrada" do servidor: completa e sem largura.
    const brokenFirst = (img: HTMLImageElement) => (img.getAttribute('src') ?? '').includes('foto-real')
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(function (this: HTMLImageElement) {
      return brokenFirst(this)
    })
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(function (this: HTMLImageElement) {
      return brokenFirst(this) ? 0 : 100
    })
    const { container } = render(<StackedCake layers={[layer('teste-ssr')]} width={100} />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/layers/teste-ssr.png')
  })

  it('se nem a imagem padrão carregar, some em vez de mostrar imagem quebrada', () => {
    const { container } = render(<StackedCake layers={[layer('teste-sem-nada')]} width={100} />)
    fireEvent.error(container.querySelector('img')!)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
  })
})
