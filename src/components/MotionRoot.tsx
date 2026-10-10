import { useEffect } from 'react'

/**
 * Liga as animações que dependem do navegador (sem bibliotecas):
 * - `[data-reveal]`: entra em cena quando aparece na tela (também para itens montados depois,
 *   como a grade de bolos ao trocar de filtro);
 * - `--scroll-y` e `data-scrolled` no <html>: parallax da foto do topo e menu compacto;
 * - `[data-tilt]`: inclinação suave que segue o cursor (só em mouse/trackpad).
 * Com "reduzir movimento" ativo no sistema, nada disso é ligado e a página fica estática.
 */
export function MotionRoot() {
  useEffect(() => {
    const root = document.documentElement
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    root.classList.add('motion')

    const reveal = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          reveal.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    )
    const observe = (scope: ParentNode) =>
      scope.querySelectorAll('[data-reveal]:not(.is-in)').forEach(el => reveal.observe(el))
    observe(document)

    const mutations = new MutationObserver(records => {
      for (const record of records)
        record.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return
          if (node.matches('[data-reveal]:not(.is-in)')) reveal.observe(node)
          observe(node)
        })
    })
    mutations.observe(document.body, { childList: true, subtree: true })

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        root.style.setProperty('--scroll-y', String(Math.min(y, 900)))
        root.dataset['scrolled'] = String(y > 16)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const cleanups: Array<() => void> = []
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach(el => {
        const move = (event: PointerEvent) => {
          const rect = el.getBoundingClientRect()
          el.style.setProperty('--tilt-x', ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3))
          el.style.setProperty('--tilt-y', ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3))
        }
        const leave = () => {
          el.style.setProperty('--tilt-x', '0')
          el.style.setProperty('--tilt-y', '0')
        }
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerleave', leave)
        cleanups.push(() => {
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerleave', leave)
        })
      })
    }

    return () => {
      reveal.disconnect()
      mutations.disconnect()
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      cleanups.forEach(fn => fn())
      root.classList.remove('motion')
    }
  }, [])

  return null
}
