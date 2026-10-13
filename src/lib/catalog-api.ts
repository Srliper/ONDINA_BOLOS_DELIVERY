import {
  CatalogError,
  createItem,
  deleteItem,
  ENTITY_LABELS,
  findItem,
  isEntityName,
  updateItem,
  type Catalog,
} from '@/lib/catalog'

/**
 * Rotas REST do catálogo (montadas em src/routes/api/):
 *   GET    /api/catalog/{products|fillings|layers}        lista (pública — o site usa)
 *   GET    /api/catalog/{entidade}/{id}                   um item (pública)
 *   POST   /api/catalog/{entidade}                        cria     (só administração)
 *   PUT    /api/catalog/{entidade}/{id}                   altera   (só administração)
 *   DELETE /api/catalog/{entidade}/{id}                   apaga    (só administração)
 * Escritas exigem sessão do /admin, JSON e a mesma origem do site (proteção contra CSRF).
 */

export interface CatalogApiDeps {
  load: () => Promise<Catalog>
  save: (catalog: Catalog) => Promise<void>
  isAdmin: () => Promise<boolean>
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

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new CatalogError(400, 'Envie os dados em JSON (Content-Type: application/json).')
  }
  try {
    return await request.json()
  } catch {
    throw new CatalogError(400, 'JSON inválido.')
  }
}

export async function handleCatalogRequest(
  request: Request,
  params: { entity: string; id?: string | undefined },
  deps: CatalogApiDeps,
): Promise<Response> {
  try {
    const { entity, id } = params
    if (!isEntityName(entity)) {
      throw new CatalogError(404, 'Entidade desconhecida. Use products, fillings ou layers.')
    }
    const method = request.method.toUpperCase()

    if (method === 'GET') {
      const catalog = await deps.load()
      if (!id) return json(200, { data: catalog[entity] })
      const item = findItem(catalog, entity, id)
      if (!item) throw new CatalogError(404, `${ENTITY_LABELS[entity].one} não encontrado.`)
      return json(200, { data: item })
    }

    // Daqui em diante, escrita: só a administração, do próprio site.
    if (!(await deps.isAdmin())) throw new CatalogError(401, 'Entre na área da equipe (/admin) para alterar o catálogo.')
    if (!sameOrigin(request)) throw new CatalogError(403, 'Origem não permitida.')

    const catalog = await deps.load()
    if (method === 'POST' && !id) {
      const result = createItem(catalog, entity, await readJson(request))
      await deps.save(result.catalog)
      return json(201, { data: result.item })
    }
    if ((method === 'PUT' || method === 'PATCH') && id) {
      const result = updateItem(catalog, entity, id, await readJson(request))
      await deps.save(result.catalog)
      return json(200, { data: result.item })
    }
    if (method === 'DELETE' && id) {
      await deps.save(deleteItem(catalog, entity, id))
      return json(200, { data: { id } })
    }
    return json(405, { error: 'Método não permitido nesta rota.' })
  } catch (error) {
    if (error instanceof CatalogError) {
      return json(error.status, { error: error.message, ...(error.issues ? { issues: error.issues } : {}) })
    }
    console.error('[catálogo] erro inesperado', error)
    return json(500, { error: 'Erro inesperado no servidor.' })
  }
}
