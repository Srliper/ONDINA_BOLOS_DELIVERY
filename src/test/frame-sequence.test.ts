import { describe, expect, it } from 'vitest'
import { fitRect, frameNumbers, nearestLoaded, preloadOrder, scrollProgress, shouldContain } from '@/lib/frame-sequence'

describe('sequência de frames da intro', () => {
  it('usa todos os frames ou um sim, outro não, sempre terminando no último', () => {
    expect(frameNumbers(5, 1)).toEqual([1, 2, 3, 4, 5])
    expect(frameNumbers(6, 2)).toEqual([1, 3, 5, 6])
    expect(frameNumbers(240, 2)).toHaveLength(121)
  })

  it('baixa o primeiro, depois 1 a cada 10, depois o resto, sem repetir', () => {
    const order = preloadOrder(25)
    expect(order.slice(0, 3)).toEqual([0, 10, 20])
    expect(new Set(order).size).toBe(25)
  })

  it('usa o frame carregado mais próximo enquanto o pedido não chegou', () => {
    expect(nearestLoaded(['a', null, null, 'd'], 2)).toBe('d')
    expect(nearestLoaded(['a', null, null, null, 'e'], 1)).toBe('a')
    expect(nearestLoaded([null, null], 0)).toBeNull()
  })

  it('preserva a proporção ao cobrir ou caber na tela', () => {
    expect(fitRect(100, 200, 100, 100, 'cover')).toEqual([0, -50, 100, 200])
    expect(fitRect(100, 200, 100, 100, 'contain')).toEqual([25, 0, 50, 100])
  })

  it('mostra o frame vertical inteiro num monitor largo, mas cobre a tela do celular', () => {
    expect(shouldContain(608, 1080, 1280, 720)).toBe(true)
    expect(shouldContain(608, 1080, 390, 844)).toBe(false)
  })

  it('converte a rolagem da seção em 0–1', () => {
    expect(scrollProgress(0, 4000, 800)).toBe(0)
    expect(scrollProgress(-1600, 4000, 800)).toBe(0.5)
    expect(scrollProgress(-9000, 4000, 800)).toBe(1)
    expect(scrollProgress(200, 4000, 800)).toBe(0)
    expect(scrollProgress(-100, 800, 800)).toBe(0)
  })
})
