import { CatalogError, catalogSchema, seedCatalog, type Catalog } from '@/lib/catalog'

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

function upstashStorage(url: string, token: string, fetchImpl: typeof fetch = fetch): CatalogStorage {
  const command = async (args: string[]) => {
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
  return {
    kind: 'upstash',
    read: async () => {
      const result = await command(['GET', KEY])
      return typeof result === 'string' ? result : null
    },
    write: async value => {
      await command(['SET', KEY, value])
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

export function getCatalogStorage(): CatalogStorage {
  const url = env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL')
  const token = env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN')
  if (url && token) return upstashStorage(url, token)
  // Na Vercel o disco é temporário: gravar em arquivo perderia as edições sem avisar.
  if (env('VERCEL')) return noStorage
  return fileStorage(env('CATALOG_FILE') ?? '.data/catalog.json')
}

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
    if (parsed.success) return parsed.data
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
