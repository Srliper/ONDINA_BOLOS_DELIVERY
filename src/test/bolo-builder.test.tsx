import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BoloBuilder } from '@/components/BoloBuilder'
import { BOLO_LAYERS, LAYER_ORDER } from '@/data/bolo-layers'

vi.mock('@/lib/confetti', () => ({ celebrate: vi.fn(() => Promise.resolve()) }))

// O Embla usa APIs de layout que o jsdom não tem.
beforeAll(() => {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
})

describe('BOLO_LAYERS', () => {
  it('tem opções para todas as etapas e ids únicos', () => {
    for (const category of LAYER_ORDER) {
      expect(BOLO_LAYERS.filter(layer => layer.category === category).length).toBeGreaterThanOrEqual(3)
    }
    expect(new Set(BOLO_LAYERS.map(layer => layer.id)).size).toBe(BOLO_LAYERS.length)
  })
})

describe('BoloBuilder', () => {
  it('só avança com a camada escolhida e entrega o bolo completo ao carrinho', async () => {
    const onAddToCart = vi.fn()
    render(<BoloBuilder onClose={() => {}} onAddToCart={onAddToCart} />)

    const next = () => screen.getByRole('button', { name: /próxima camada|ver o resumo/i })
    expect(next()).toBeDisabled()

    for (const name of ['Base Redonda Tradicional', 'Prestígio', 'Chantilly Premium', 'Detalhes Dourados']) {
      fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^Escolher .*${name}`) }))
      expect(next()).toBeEnabled()
      fireEvent.click(next())
    }

    fireEvent.click(await screen.findByRole('button', { name: /Adicionar bolo personalizado ao carrinho por R\$\s64,00/ }))

    expect(onAddToCart).toHaveBeenCalledTimes(1)
    const [selection, total] = onAddToCart.mock.calls[0]
    expect(total).toBe(64)
    expect(selection.base.id).toBe('base-redonda')
    expect(selection.decoracao.id).toBe('decoracao-detalhes-dourados')
  })
})
