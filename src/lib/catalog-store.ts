import { CatalogError, catalogSchema, seedCatalog, withNewDefaults, type Catalog } from '@/lib/catalog'

/**
 * Onde o catálogo fica guardado (só no servidor):
 * - Upstash Redis (Vercel → Storage/Marketplace) quando houver KV_REST_API_URL + KV_REST_API_TOKEN
 *   (ou UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) — usado no site publicado;
 * - arquivo JSON local (.data/catalog.json ou CATALOG_FILE) no computador, para desenvolver;
 * - sem nenhum dos dois em produção, o site usa o cardápio padrão e o painel avisa que falta o banco.
 */

const KEY = 'ondina:catalog'

export interface CatalogStorage {
  kind: 'upstash' | 'file' | 'none'
  read(): Promise<string | null>
  write(value: string): Promise<void>
}

const env = (name: string) => process.env[name] || undefined

/** Um comando do Redis pela API REST do Upstash (ex.: ['GET', 'chave']). */
export function upstashCommand(url: string, token: string, fetchImpl: typeof fetch = fetch) {
  return async (args: string[]): Promise<unknown> => {
    const response = await fetchImpl(url.replace(/\/+$/, ''), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!response.ok) throw new CatalogError(503, `O banco de dados respondeu ${response.status}.`)
    const body = (await response.json()) as { result?: unknown; error?: string }
    if (body.error) throw new CatalogError(503, `Erro no banco de dados: ${body.error}`)
    return body.result
  }
}

/** Endereço e token do Upstash nas variáveis de ambiente (Vercel → Storage), se houver. */
export function upstashConfig(): { url: string; token: string } | undefined {
  const url = env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL')
  const token = env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN')
  return url && token ? { url, token } : undefined
}

function upstashStorage(url: string, token: string, fetchImpl: typeof fetch = fetch, key = KEY): CatalogStorage {
  const command = upstashCommand(url, token, fetchImpl)
  return {
    kind: 'upstash',
    read: async () => {
      const result = await command(['GET', key])
      return typeof result === 'string' ? result : null
    },
    write: async value => {
      await command(['SET', key, value])
    },
  }
}

function fileStorage(path: string): CatalogStorage {
  return {
    kind: 'file',
    read: async () => {
      const { readFile } = await import('node:fs/promises')
      try {
        return await readFile(path, 'utf8')
      } catch {
        return null
      }
    },
    write: async value => {
      const { mkdir, writeFile } = await import('node:fs/promises')
      const { dirname } = await import('node:path')
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, value, 'utf8')
    },
  }
}

const noStorage: CatalogStorage = {
  kind: 'none',
  read: async () => null,
  write: async () => {
    throw new CatalogError(
      503,
      'O banco de dados ainda não foi configurado no servidor. Conecte o Upstash Redis na Vercel (veja o README).',
    )
  },
}

const catalogFile = () => env('CATALOG_FILE') ?? '.data/catalog.json'

/** Pasta dos arquivos locais (a mesma do catálogo), terminando em "/". */
export const localDataDir = () => catalogFile().replace(/[^/\\]+$/, '')

export function getCatalogStorage(): CatalogStorage {
  const upstash = upstashConfig()
  if (upstash) return upstashStorage(upstash.url, upstash.token)
  // Na Vercel o disco é temporário: gravar em arquivo perderia as edições sem avisar.
  if (env('VERCEL')) return noStorage
  return fileStorage(catalogFile())
}

/** Fotos enviadas pelo painel: uma chave por foto no mesmo banco (ou arquivos ao lado do catálogo). */
export function getImageStorage(id: string): CatalogStorage {
  const upstash = upstashConfig()
  if (upstash) return upstashStorage(upstash.url, upstash.token, fetch, `ondina:image:${id}`)
  if (env('VERCEL')) return noStorage
  return fileStorage(`${localDataDir()}images/${id}.json`)
}

/**
 * Pedidos do site (fluxo com status): um documento JSON no mesmo banco, ou orders-v2.json ao lado
 * do catálogo. A chave é nova porque `ondina:orders` guarda a lista do formato antigo (só leitura).
 */
export function getOrdersStorage(): CatalogStorage {
  const upstash = upstashConfig()
  if (upstash) return upstashStorage(upstash.url, upstash.token, fetch, 'ondina:orders:v2')
  if (isEphemeralServer()) return noStorage
  return fileStorage(`${localDataDir()}orders-v2.json`)
}

/** Pedidos de "avise-me quando chegar" dos bolos esgotados (mesmo banco). */
export function getStockRequestsStorage(): CatalogStorage {
  const upstash = upstashConfig()
  if (upstash) return upstashStorage(upstash.url, upstash.token, fetch, 'ondina:stock-requests')
  if (isEphemeralServer()) return noStorage
  return fileStorage(`${localDataDir()}stock-requests.json`)
}

/** Sem banco na Vercel (disco temporário): nada pode ser guardado. */
export const isEphemeralServer = () => Boolean(env('VERCEL'))

/** Lê o catálogo guardado; sem nada guardado (ou guardado com defeito), usa o padrão. */
export async function loadCatalog(storage = getCatalogStorage()): Promise<Catalog> {
  let raw: string | null = null
  try {
    raw = await storage.read()
  } catch (error) {
    console.error('[catálogo] não foi possível ler o banco; usando o cardápio padrão', error)
  }
  if (!raw) return seedCatalog()
  try {
    const parsed = catalogSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return withNewDefaults(parsed.data)
    console.error('[catálogo] dados guardados fora do formato; usando o cardápio padrão', parsed.error.issues[0])
  } catch (error) {
    console.error('[catálogo] JSON inválido no banco; usando o cardápio padrão', error)
  }
  return seedCatalog()
}

export async function saveCatalog(catalog: Catalog, storage = getCatalogStorage()): Promise<void> {
  await storage.write(JSON.stringify(catalogSchema.parse(catalog)))
}

export { upstashStorage as createUpstashStorage }
