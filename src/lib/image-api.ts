import { CatalogError } from '@/lib/catalog'

/**
 * Fotos enviadas pelo painel /admin (bolos, recheios e camadas), sem depender de outro serviço:
 *   POST /api/images        { dataUrl: "data:image/jpeg;base64,..." }  → { data: { url: "/api/images/<id>" } }
 *                           só administração, JSON e a mesma origem do site
 *   GET  /api/images/<id>   a foto (pública, com cache longo — o id nunca é reaproveitado)
 * O navegador já reduz a foto antes de enviar (src/lib/image-resize.ts). Aceita só JPEG, PNG e WebP,
 * conferindo os bytes do arquivo — nunca SVG/HTML, que poderiam rodar script no domínio do site.
 */

export const MAX_IMAGE_BYTES = 1_000_000

const TYPES = {
  'image/jpeg': (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b: Uint8Array) =>
    String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
} as const
type ImageType = keyof typeof TYPES

const ID_PATTERN = /^img-[a-z0-9]{6,40}$/

export interface StoredImage {
  type: ImageType
  /** Conteúdo em base64. */
  data: string
}

export interface ImageApiDeps {
  read: (id: string) => Promise<string | null>
  write: (id: string, value: string) => Promise<void>
  isAdmin: () => Promise<boolean>
  newId?: () => string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

const randomId = () =>
  `img-${Date.now().toString(36)}${Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(36).padStart(2, '0')).join('')}`

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))

/** Confere o data URL e devolve a foto pronta para guardar. */
export function parseImageDataUrl(dataUrl: unknown): StoredImage {
  const match = typeof dataUrl === 'string' ? /^data:([a-z/]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl) : null
  const type = match?.[1]
  if (!match || !type || !(type in TYPES)) {
    throw new CatalogError(400, 'Envie uma foto em JPG, PNG ou WebP.', { image: 'Formato de foto não aceito.' })
  }
  const data = match[2] ?? ''
  if ((data.length * 3) / 4 > MAX_IMAGE_BYTES) {
    throw new CatalogError(400, 'A foto ficou grande demais (máximo 1 MB).', { image: 'Use uma foto menor.' })
  }
  let bytes: Uint8Array
  try {
    bytes = decodeBase64(data)
  } catch {
    throw new CatalogError(400, 'Foto corrompida.', { image: 'Foto corrompida.' })
  }
  if (!TYPES[type as ImageType](bytes)) {
    throw new CatalogError(400, 'O arquivo não é uma foto válida.', { image: 'O arquivo não é uma foto válida.' })
  }
  return { type: type as ImageType, data }
}

export async function handleImageRequest(
  request: Request,
  params: { id?: string | undefined },
  deps: ImageApiDeps,
): Promise<Response> {
  try {
    const method = request.method.toUpperCase()

    if (method === 'GET' && params.id) {
      const raw = ID_PATTERN.test(params.id) ? await deps.read(params.id) : null
      const stored = raw ? (JSON.parse(raw) as Partial<StoredImage>) : undefined
      if (!stored?.data || !stored.type || !(stored.type in TYPES)) {
        return new Response('Foto não encontrada.', { status: 404, headers: { 'Cache-Control': 'no-store' } })
      }
      return new Response(decodeBase64(stored.data), {
        headers: {
          'Content-Type': stored.type,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    if (method === 'POST' && !params.id) {
      if (!(await deps.isAdmin())) throw new CatalogError(401, 'Entre na área da equipe (/admin) para enviar fotos.')
      if (!sameOrigin(request)) throw new CatalogError(403, 'Origem não permitida.')
      if (!request.headers.get('content-type')?.includes('application/json')) {
        throw new CatalogError(400, 'Envie os dados em JSON (Content-Type: application/json).')
      }
      const body = (await request.json().catch(() => ({}))) as { dataUrl?: unknown }
      const image = parseImageDataUrl(body.dataUrl)
      const id = (deps.newId ?? randomId)()
      await deps.write(id, JSON.stringify(image))
      return json(201, { data: { id, url: `/api/images/${id}` } })
    }

    return json(405, { error: 'Método não permitido nesta rota.' })
  } catch (error) {
    if (error instanceof CatalogError) {
      return json(error.status, { error: error.message, ...(error.issues ? { issues: error.issues } : {}) })
    }
    console.error('[fotos] erro inesperado', error)
    return json(500, { error: 'Erro inesperado no servidor.' })
  }
}
