import { useEffect, useRef } from 'react'
import { ArrowDown } from 'lucide-react'
import logo from '@/assets/ondina_logo.png'
import {
  fitRect,
  frameNumbers,
  INTRO_FRAME_COUNT,
  INTRO_STATIC_FRAME,
  introFramePath,
  nearestLoaded,
  preloadOrder,
  scrollProgress,
  shouldContain,
  type FitMode,
} from '@/lib/frame-sequence'

/** 0–1: quanto o frame exibido anda em direção ao da rolagem a cada quadro (menor = mais suave). */
const SMOOTHING = 0.16
const CONCURRENCY = 6
/**
 * Intro parada (um frame só, sem prender a tela): "reduzir movimento" e celular.
 * No celular a sequência rolada pesava (frames deitados numa tela em pé, fundo desfocado
 * redesenhado a cada quadro e 4 telas de rolagem antes do cardápio).
 */
const STATIC_QUERY = '(prefers-reduced-motion: reduce), (max-width: 700px), (pointer: coarse) and (max-height: 500px)'

const CAPTIONS = [
  { from: 0, to: 0.24, kicker: 'Feito à mão', line: 'Do nosso forno', accent: 'pra sua mesa.' },
  { from: 0.3, to: 0.55, kicker: 'Naked cake com frutas', line: 'Camadas de massa,', accent: 'chantilly e morango.' },
  { from: 0.62, to: 0.84, kicker: 'Na hora do corte', line: 'Recheio generoso', accent: 'em cada fatia.' },
  { from: 0.88, to: 1.01, kicker: 'Pronto pro café', line: 'Agora é só', accent: 'pedir o seu.' },
]

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.decoding = 'async'
    // decode() evita travadas na primeira vez que o frame é desenhado
    img.onload = () =>
      img.decode().then(
        () => resolve(img),
        () => resolve(img),
      )
    img.onerror = () => resolve(null) // frame com problema é pulado, nunca imagem quebrada
    img.src = src
  })
}

/**
 * Intro do topo: a sequência de frames do naked cake troca conforme o cliente rola,
 * com o palco preso na tela. Desenha em canvas; com "reduzir movimento" ou no celular, mostra só o
 * frame do bolo inteiro, sem baixar a sequência.
 */
export function ScrollIntro() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdropRef = useRef<HTMLCanvasElement>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const canvas = canvasRef.current
    const backdrop = backdropRef.current
    const loader = loaderRef.current
    const ctx = canvas?.getContext('2d')
    const bctx = backdrop?.getContext('2d')
    if (!section || !stage || !canvas || !backdrop || !loader || !ctx || !bctx) return

    const captions = [...section.querySelectorAll<HTMLElement>('.intro-caption')]
    const staticMode = window.matchMedia(STATIC_QUERY)
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    // Pouca memória: um frame sim, outro não. Cada frame decodificado ocupa alguns MB.
    const lowMemory = (deviceMemory !== undefined && deviceMemory <= 4) || connection?.saveData === true
    // Economia de dados ligada: 1 a cada 4 (a animação continua, com 60 frames).
    const numbers = frameNumbers(INTRO_FRAME_COUNT, connection?.saveData ? 4 : lowMemory ? 2 : 1)
    const images: (HTMLImageElement | null)[] = numbers.map(() => null)

    let current = 0
    let target = 0
    let raf = 0
    let staticImage: HTMLImageElement | null = null
    let preloadStarted = false
    let disposed = false

    const setLoaded = (fraction: number) => {
      loader.style.setProperty('--loaded', String(fraction))
      if (fraction >= 1) section.dataset['loaded'] = 'true'
    }

    const preloadAll = () => {
      if (preloadStarted) return
      preloadStarted = true
      const queue = preloadOrder(numbers.length)
      const total = queue.length
      let done = 0
      const worker = async () => {
        while (queue.length && !disposed) {
          const i = queue.shift()!
          images[i] = await loadImage(introFramePath(numbers[i]!))
          done += 1
          setLoaded(done / total)
          // Redesenha a cada chegada: o frame novo pode ser o mais próximo do atual (ex.: o primeiro falhou)
          requestRender()
        }
      }
      for (let k = 0; k < CONCURRENCY; k++) void worker()
    }

    const drawImage = (context: CanvasRenderingContext2D, img: HTMLImageElement, mode: FitMode, alpha: number) => {
      const [x, y, w, h] = fitRect(
        img.naturalWidth,
        img.naturalHeight,
        context.canvas.width,
        context.canvas.height,
        mode,
      )
      context.globalAlpha = alpha
      context.drawImage(img, x, y, w, h)
      context.globalAlpha = 1
    }

    /** Desenha a posição `pos`, misturando o frame de baixo com o de cima para a troca ficar suave. */
    const draw = (pos: number) => {
      const base = Math.floor(pos)
      const frac = pos - base
      const a = staticImage ?? nearestLoaded(images, base)
      if (!a) return
      const contain = shouldContain(a.naturalWidth, a.naturalHeight, canvas.width, canvas.height)
      const mode: FitMode = contain ? 'contain' : 'cover'
      backdrop.style.visibility = contain ? 'visible' : 'hidden'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (contain) drawImage(bctx, a, 'cover', 1)
      drawImage(ctx, a, mode, 1)
      const b = !staticImage && frac > 0.01 ? images[base + 1] : null
      if (b) drawImage(ctx, b, mode, frac)
    }

    const tick = () => {
      raf = 0
      const diff = target - current
      current = Math.abs(diff) < 0.005 ? target : current + diff * SMOOTHING
      draw(current)
      if (current !== target) raf = requestAnimationFrame(tick)
    }
    const requestRender = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(tick)
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(stage.clientWidth * dpr)
      canvas.height = Math.round(stage.clientHeight * dpr)
      // O fundo é desfocado: resolução baixa basta
      backdrop.width = Math.max(1, Math.round(stage.clientWidth / 8))
      backdrop.height = Math.max(1, Math.round(stage.clientHeight / 8))
      ctx.imageSmoothingQuality = 'high'
      requestRender()
    }

    // O palco prende abaixo do menu (top do sticky), não no topo da janela
    const progress = () =>
      scrollProgress(
        section.getBoundingClientRect().top - (parseFloat(getComputedStyle(stage).top) || 0),
        section.offsetHeight,
        stage.offsetHeight,
      )

    const onScroll = () => {
      // Enquanto a intro cobre a maior parte da tela, o WhatsApp flutuante fica escondido (ver styles.css)
      document.documentElement.dataset['intro'] =
        section.getBoundingClientRect().bottom > window.innerHeight * 0.5 ? 'on' : 'off'
      if (staticMode.matches) return
      const p = progress()
      target = p * (numbers.length - 1)
      captions.forEach((el, i) => el.classList.toggle('is-visible', p >= CAPTIONS[i]!.from && p < CAPTIONS[i]!.to))
      section.dataset['started'] = String(p > 0.02)
      requestRender()
    }

    const applyMode = async () => {
      if (staticMode.matches) {
        captions.forEach((el, i) => el.classList.toggle('is-visible', i === 0))
        setLoaded(1)
        staticImage = (await loadImage(introFramePath(INTRO_STATIC_FRAME))) ?? (await loadImage(introFramePath(1)))
        if (!disposed) draw(0)
        onScroll()
      } else {
        staticImage = null
        preloadAll()
        current = target = progress() * (numbers.length - 1)
        onScroll()
      }
    }

    const observer = new ResizeObserver(() => {
      resize()
      onScroll()
    })
    observer.observe(stage)
    window.addEventListener('scroll', onScroll, { passive: true })
    staticMode.addEventListener('change', applyMode)
    resize()
    void applyMode()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      staticMode.removeEventListener('change', applyMode)
      delete document.documentElement.dataset['intro']
    }
  }, [])

  return (
    <section ref={sectionRef} className="intro" aria-label="Animação: como nasce o naked cake da Ondina">
      <div ref={stageRef} className="intro-stage">
        <canvas ref={backdropRef} className="intro-backdrop" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="intro-canvas"
          role="img"
          aria-label="Mãos colocam morangos num naked cake, o bolo é cortado e uma fatia é servida com café."
        />
        <noscript>
          <img
            className="intro-fallback"
            src={introFramePath(INTRO_STATIC_FRAME)}
            alt="Naked cake da Ondina com morangos"
          />
        </noscript>

        <div className="intro-captions">
          {CAPTIONS.map(c => (
            <p key={c.kicker} className="intro-caption">
              <small>{c.kicker}</small>
              {c.line}
              <br />
              <em>{c.accent}</em>
            </p>
          ))}
        </div>

        {/* O menu só aparece depois da intro; aqui fica só a marca */}
        <div className="intro-brand">
          <img src={logo} alt="" width={44} height={44} />
          <div>
            <strong>Ondina Bolos</strong>
            <small>Desde 2003</small>
          </div>
        </div>

        <div ref={loaderRef} className="intro-loader" aria-hidden="true">
          <span />
        </div>
        <a className="intro-skip" href="#bolos">
          Pular para o cardápio
          <ArrowDown size={14} aria-hidden="true" />
        </a>
        <span className="intro-note">Imagens ilustrativas</span>
      </div>
    </section>
  )
}
