/*
 * Animação de rolagem com sequência de imagens (frame-0001.webp … frame-0240.webp).
 * O palco fica preso na tela (position: sticky) e o frame acompanha a rolagem da seção.
 */
;(() => {
  'use strict'

  const CONFIG = {
    frameCount: 240,
    framePath: n => `../public/intro/frames/frame-${String(n).padStart(4, '0')}.webp`,
    /** Frame mostrado parado quando o usuário pede movimento reduzido (bolo inteiro). */
    staticFrame: 96,
    /** 0–1: quanto o frame exibido anda em direção ao alvo a cada quadro (menor = mais suave). */
    smoothing: 0.16,
    /** Downloads em paralelo. */
    concurrency: 6,
    /** Abaixo dessa fração visível da imagem, em vez de cortar, mostra inteira com fundo desfocado. */
    minCoverVisible: 0.7,
  }

  const section = document.getElementById('scrolly')
  const stage = section.querySelector('.stage')
  const canvas = document.getElementById('canvas')
  const backdrop = document.getElementById('backdrop')
  const loader = document.getElementById('loader')
  const loaderFill = document.getElementById('loader-fill')
  const loaderText = document.getElementById('loader-text')
  const scrollHint = document.getElementById('scroll-hint')
  const captions = [...section.querySelectorAll('.caption')].map(el => ({
    el,
    from: Number(el.dataset.from),
    to: Number(el.dataset.to),
  }))

  const ctx = canvas.getContext('2d')
  const bctx = backdrop.getContext('2d', { alpha: false })
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  // Celular ou aparelho com pouca memória: usa um frame sim, outro não (120 imagens em vez de 240).
  // Cada frame decodificado ocupa alguns MB; 240 deles podem derrubar o Safari do iPhone.
  const lowMemory =
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.connection && navigator.connection.saveData) ||
    window.matchMedia('(max-width: 700px)').matches
  const step = lowMemory ? 2 : 1

  /** Números dos frames em uso, em ordem (o último sempre entra). */
  const frameNumbers = []
  for (let n = 1; n <= CONFIG.frameCount; n += step) frameNumbers.push(n)
  if (frameNumbers[frameNumbers.length - 1] !== CONFIG.frameCount) frameNumbers.push(CONFIG.frameCount)

  /** images[i] corresponde a frameNumbers[i]; fica null até carregar (ou se falhar). */
  const images = new Array(frameNumbers.length).fill(null)

  let current = 0 // posição exibida (fracionária, para o cruzamento suave)
  let target = 0 // posição pedida pela rolagem
  let rafId = 0
  let staticImage = null
  let preloadStarted = false

  /* ------------------------------ Carregamento ------------------------------ */

  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        // decode() evita travadas na primeira vez que o frame é desenhado
        if (img.decode)
          img.decode().then(
            () => resolve(img),
            () => resolve(img),
          )
        else resolve(img)
      }
      img.onerror = () => resolve(null) // frame com problema é pulado, nunca imagem quebrada
      img.src = src
    })
  }

  /**
   * Ordem de download: primeiro frame, depois 1 a cada 10 (dá para rolar logo, com saltos),
   * depois o resto preenchendo os buracos.
   */
  function preloadOrder() {
    const order = [0]
    const seen = new Set(order)
    for (const stride of [10, 1]) {
      for (let i = 0; i < frameNumbers.length; i += stride) {
        if (!seen.has(i)) {
          seen.add(i)
          order.push(i)
        }
      }
    }
    return order
  }

  function preloadAll() {
    if (preloadStarted) return
    preloadStarted = true

    const queue = preloadOrder()
    const total = queue.length
    let done = 0

    const next = async () => {
      while (queue.length) {
        const i = queue.shift()
        images[i] = await loadImage(CONFIG.framePath(frameNumbers[i]))
        done += 1
        updateLoader(done / total)
        // Redesenha a cada chegada: o frame novo pode ser o mais próximo do atual (ex.: o primeiro falhou)
        requestRender()
      }
    }
    for (let k = 0; k < CONFIG.concurrency; k++) next()
  }

  function updateLoader(fraction) {
    const pct = Math.round(fraction * 100)
    loaderFill.style.width = pct + '%'
    loaderText.textContent = `Carregando ${pct}%`
    if (fraction >= 1) {
      loaderText.textContent = 'Pronto'
      loader.classList.add('is-done')
    }
  }

  /** Frame carregado mais próximo do pedido (enquanto o resto ainda baixa). */
  function nearestImage(i) {
    if (images[i]) return images[i]
    for (let d = 1; d < images.length; d++) {
      if (images[i - d]) return images[i - d]
      if (images[i + d]) return images[i + d]
    }
    return null
  }

  /* -------------------------------- Desenho -------------------------------- */

  function resizeCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = stage.clientWidth
    const h = stage.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    // O fundo é desfocado: resolução baixa basta e economiza muito
    backdrop.width = Math.max(1, Math.round(w / 8))
    backdrop.height = Math.max(1, Math.round(h / 8))
    ctx.imageSmoothingQuality = 'high'
    requestRender()
  }

  /** Retângulo para desenhar a imagem preservando a proporção ('cover' corta, 'contain' cabe inteira). */
  function fit(img, cw, ch, mode) {
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const scale = mode === 'cover' ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih)
    const w = iw * scale
    const h = ih * scale
    return [(cw - w) / 2, (ch - h) / 2, w, h]
  }

  /** Cobrir a tela cortaria demais (ex.: frame vertical num monitor largo)? */
  function shouldContain(img, cw, ch) {
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
    const visible = (cw * ch) / (img.naturalWidth * img.naturalHeight * scale * scale)
    return visible < CONFIG.minCoverVisible
  }

  function drawImage(context, img, mode, alpha) {
    const [x, y, w, h] = fit(img, context.canvas.width, context.canvas.height, mode)
    context.globalAlpha = alpha
    context.drawImage(img, x, y, w, h)
    context.globalAlpha = 1
  }

  /** Desenha a posição `pos`: mistura o frame de baixo com o de cima para a troca ficar suave. */
  function draw(pos) {
    const base = Math.floor(pos)
    const frac = pos - base
    const a = staticImage || nearestImage(base)
    if (!a) return

    const contain = shouldContain(a, canvas.width, canvas.height)
    const mode = contain ? 'contain' : 'cover'
    backdrop.style.visibility = contain ? 'visible' : 'hidden'

    // No modo 'contain' a área fora da imagem fica transparente, mostrando o fundo desfocado
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (contain) drawImage(bctx, a, 'cover', 1)
    drawImage(ctx, a, mode, 1)

    const b = !staticImage && frac > 0.01 ? images[base + 1] : null
    if (b) drawImage(ctx, b, mode, frac)
  }

  function requestRender() {
    if (!rafId) rafId = requestAnimationFrame(tick)
  }

  function tick() {
    rafId = 0
    const diff = target - current
    if (Math.abs(diff) < 0.005) current = target
    else current += diff * CONFIG.smoothing
    draw(current)
    if (current !== target) rafId = requestAnimationFrame(tick)
  }

  /* -------------------------------- Rolagem -------------------------------- */

  function scrollProgress() {
    const rect = section.getBoundingClientRect()
    const distance = section.offsetHeight - stage.offsetHeight
    if (distance <= 0) return 0
    return Math.min(1, Math.max(0, -rect.top / distance))
  }

  function updateCaptions(p) {
    for (const c of captions) c.el.classList.toggle('is-visible', p >= c.from && p < c.to)
  }

  function onScroll() {
    if (reducedMotion.matches) return
    const p = scrollProgress()
    target = p * (frameNumbers.length - 1)
    updateCaptions(p)
    scrollHint.classList.toggle('is-hidden', p > 0.02)
    requestRender()
  }

  /* ------------------------------ Modos ------------------------------ */

  async function enterReducedMotion() {
    // Sem animação: uma imagem parada e o primeiro texto, sem baixar a sequência inteira
    for (const c of captions) c.el.classList.remove('is-visible')
    captions[0].el.classList.add('is-visible')
    loader.classList.add('is-done')
    staticImage = await loadImage(CONFIG.framePath(CONFIG.staticFrame))
    if (!staticImage) staticImage = await loadImage(CONFIG.framePath(1))
    draw(0)
  }

  function enterScrollMode() {
    staticImage = null
    loader.classList.toggle('is-done', images.every(Boolean))
    preloadAll()
    current = target = scrollProgress() * (frameNumbers.length - 1)
    onScroll()
    requestRender()
  }

  function applyMode() {
    if (reducedMotion.matches) enterReducedMotion()
    else enterScrollMode()
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  new ResizeObserver(() => {
    resizeCanvases()
    onScroll()
  }).observe(stage)
  reducedMotion.addEventListener('change', applyMode)

  resizeCanvases()
  applyMode()
})()
