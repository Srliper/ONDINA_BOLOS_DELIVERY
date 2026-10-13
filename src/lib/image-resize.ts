/**
 * Prepara a foto escolhida no painel antes de enviar: reduz o tamanho (fotos de celular têm
 * vários MB) e converte para JPEG — ou WebP/PNG quando precisa manter o fundo transparente
 * (camadas do Monte seu Bolo). O limite do servidor é 1 MB (src/lib/image-api.ts).
 */

const LIMIT_CHARS = 1_000_000 * 1.33

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function prepareImage(file: File, { transparent = false } = {}): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de foto (JPG, PNG ou WebP).')
  const image = await loadImage(file).catch(() => {
    throw new Error('Não foi possível abrir essa foto. Tente outra (JPG ou PNG).')
  })

  for (const maxSide of [1200, 900, 700, 500]) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) break
    if (!transparent) {
      // JPEG não tem transparência: fundo branco em vez de preto.
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    let dataUrl = transparent ? canvas.toDataURL('image/webp', 0.86) : canvas.toDataURL('image/jpeg', 0.84)
    // Navegadores antigos não geram WebP e devolvem PNG.
    if (transparent && !dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png')
    if (dataUrl.length <= LIMIT_CHARS) return dataUrl
  }
  throw new Error('A foto é grande demais. Tente uma foto menor.')
}
