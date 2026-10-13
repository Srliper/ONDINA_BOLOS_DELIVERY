import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { AlertTriangle, ImageUp, Loader2, Minus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { hasDefaultLayerArt, LAYER_LABELS } from '@/data/bolo-layers'
import { CATEGORY_LABEL, defaultProductImage } from '@/data/products'
import {
  ENTITY_LABELS,
  ENTITY_NAMES,
  type CatalogFilling,
  type CatalogLayer,
  type CatalogProduct,
  type EntityItem,
  type EntityName,
} from '@/lib/catalog'
import { getCatalogStorageKind } from '@/lib/catalog-server'
import { formatBRL } from '@/lib/format'
import { prepareImage } from '@/lib/image-resize'

type AnyItem = CatalogProduct | CatalogFilling | CatalogLayer
type Lists = { [E in EntityName]: EntityItem<E>[] }
type Errors = Record<string, string>

const api = (entity: EntityName, id?: string) => `/api/catalog/${entity}${id ? `/${encodeURIComponent(id)}` : ''}`

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    ...(init?.body ? { headers: { 'Content-Type': 'application/json' } } : {}),
    credentials: 'same-origin',
  })
  const body = (await response.json().catch(() => ({}))) as { data?: T; error?: string; issues?: Errors }
  if (!response.ok) throw Object.assign(new Error(body.error ?? `Erro ${response.status}`), { issues: body.issues })
  return body.data as T
}

/** Foto mostrada na lista: a do item ou a padrão do cardápio original. */
function previewSrc(entity: EntityName, item: AnyItem): string {
  if (item.image_url) return item.image_url
  if (entity === 'products') return defaultProductImage(item.id) ?? '/favicon.png'
  return hasDefaultLayerArt(item.id) ? `/layers/${item.id}.png` : '/favicon.png'
}

function detail(entity: EntityName, item: AnyItem): string {
  if (entity === 'products') {
    const product = item as CatalogProduct
    return `${CATEGORY_LABEL[product.category]} · ${product.price_unit}${product.featured ? ' · destaque' : ''}`
  }
  const badge = (item as CatalogFilling).badge
  const category = entity === 'layers' ? LAYER_LABELS[(item as CatalogLayer).category] : 'Recheio'
  return badge ? `${category} · ${badge === 'premium' ? 'Premium' : 'Mais pedido'}` : category
}

/** Cadastro de bolos, recheios e camadas, usando as rotas REST /api/catalog. */
export function CatalogManager() {
  const router = useRouter()
  const [tab, setTab] = useState<EntityName>('products')
  const [lists, setLists] = useState<Lists>()
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<{ entity: EntityName; item?: AnyItem }>()
  const [storage, setStorage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [products, fillings, layers] = await Promise.all(ENTITY_NAMES.map(entity => request<AnyItem[]>(api(entity))))
      setLists({ products, fillings, layers } as Lists)
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o cardápio.')
    }
  }, [])

  useEffect(() => {
    void load()
    getCatalogStorageKind().then(setStorage, () => setStorage(null))
  }, [load])

  // Depois de salvar: atualiza a lista e o cardápio do site (loader da rota raiz).
  const refresh = async () => {
    await load()
    await router.invalidate()
  }

  const remove = async (entity: EntityName, item: AnyItem) => {
    if (!window.confirm(`Excluir "${item.name}" de ${ENTITY_LABELS[entity].many}? Isso tira o item do site.`)) return
    try {
      await request(api(entity, item.id), { method: 'DELETE' })
      toast.success(`${item.name} excluído`)
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir.')
    }
  }

  // Estoque direto na lista: cada toque salva na hora (vazio/sem controle → 0 ou 1).
  const [stockBusy, setStockBusy] = useState<string>()
  const changeStock = async (product: CatalogProduct, delta: number) => {
    const next = Math.max(0, (product.stock ?? (delta > 0 ? 0 : 1)) + delta)
    setStockBusy(product.id)
    try {
      await request(api('products', product.id), { method: 'PUT', body: JSON.stringify({ stock: next }) })
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível mudar o estoque.')
    } finally {
      setStockBusy(undefined)
    }
  }

  const items = (lists?.[tab] ?? []) as AnyItem[]

  return (
    <section className="admin-card admin-catalog" aria-labelledby="admin-catalog-title">
      <div className="admin-orders-head">
        <h2 id="admin-catalog-title">Cardápio do site</h2>
        <button type="button" className="admin-refresh" onClick={() => setEditing({ entity: tab })}>
          <Plus aria-hidden="true" /> Adicionar {ENTITY_LABELS[tab].one.toLowerCase()}
        </button>
      </div>
      <p className="admin-muted">
        Estoque, preços, descrições e fotos. O que você salvar aqui aparece no site na hora. Dúvidas? Veja o{' '}
        <a href="#admin-tutorial-title">tutorial do painel</a>.
      </p>

      {storage === 'none' && (
        <p className="admin-warning" role="status">
          <AlertTriangle aria-hidden="true" />
          O banco de dados ainda não está ligado no servidor: dá para ver o cardápio, mas não salvar. Conecte o Upstash
          Redis na Vercel (passo a passo no README).
        </p>
      )}

      <div className="admin-tabs" role="group" aria-label="Tipo de item">
        {ENTITY_NAMES.map(entity => (
          <button key={entity} type="button" aria-pressed={tab === entity} onClick={() => setTab(entity)}>
            {ENTITY_LABELS[entity].many}
            {lists && <span>{lists[entity].length}</span>}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="admin-error" role="alert">
          {loadError}
        </p>
      )}
      {!lists && !loadError && <p className="admin-muted">Carregando…</p>}

      <ul className="admin-items">
        {items.map(item => (
          <li key={item.id} className="admin-item">
            <img src={previewSrc(tab, item)} alt="" width={56} height={56} loading="lazy" />
            <div className="admin-item-info">
              <strong>{item.name}</strong>
              <small>{detail(tab, item)}</small>
            </div>
            <span className="admin-item-price">{formatBRL(item.price)}</span>
            {tab === 'products' && (
              <StockControl
                product={item as CatalogProduct}
                busy={stockBusy === item.id}
                onChange={delta => void changeStock(item as CatalogProduct, delta)}
              />
            )}
            <div className="admin-item-actions">
              <button type="button" onClick={() => setEditing({ entity: tab, item })} aria-label={`Editar ${item.name}`}>
                <Pencil aria-hidden="true" />
              </button>
              <button type="button" onClick={() => void remove(tab, item)} aria-label={`Excluir ${item.name}`}>
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <ItemForm
          key={`${editing.entity}:${editing.item?.id ?? 'novo'}`}
          entity={editing.entity}
          item={editing.item}
          onCancel={() => setEditing(undefined)}
          onSaved={async name => {
            toast.success(`${name} salvo`)
            setEditing(undefined)
            await refresh()
          }}
        />
      )}
    </section>
  )
}

/* ---------- Formulário (criar / editar) ---------- */

interface FormState {
  id: string
  name: string
  price: string
  description: string
  image_url: string
  category: string
  price_unit: string
  unit: string
  featured: boolean
  badge: string
  stock: string
}

function initialState(entity: EntityName, item?: AnyItem): FormState {
  const product = item as CatalogProduct | undefined
  const withBadge = item as (CatalogFilling | CatalogLayer) | undefined
  return {
    id: item?.id ?? '',
    name: item?.name ?? '',
    price: item ? String(item.price).replace('.', ',') : '',
    description: item?.description ?? '',
    image_url: item?.image_url ?? '',
    category:
      entity === 'products' ? (product?.category ?? 'festas') : entity === 'layers' ? ((item as CatalogLayer | undefined)?.category ?? 'base') : '',
    price_unit: product?.price_unit ?? 'o quilo',
    unit: product?.unit ?? 'kg',
    featured: product?.featured ?? false,
    badge: withBadge?.badge ?? '',
    stock: product?.stock == null ? '' : String(product.stock),
  }
}

function toPayload(entity: EntityName, form: FormState, creating: boolean) {
  const price = Number(form.price.replace(/\./g, '').replace(',', '.'))
  const base = {
    ...(creating && form.id.trim() ? { id: form.id.trim() } : {}),
    name: form.name,
    price: form.price.trim() === '' || Number.isNaN(price) ? form.price : price,
    description: form.description,
    image_url: form.image_url.trim(),
  }
  if (entity === 'products') {
    const stock = form.stock.trim() === '' ? null : Number(form.stock.trim())
    return {
      ...base,
      category: form.category,
      price_unit: form.price_unit,
      unit: form.unit,
      featured: form.featured,
      // Texto inválido vai como está, para o servidor devolver a mensagem do campo.
      stock: stock !== null && Number.isNaN(stock) ? form.stock : stock,
    }
  }
  const badge = form.badge === '' ? null : form.badge
  return entity === 'layers' ? { ...base, category: form.category, badge } : { ...base, badge }
}

function ItemForm({
  entity,
  item,
  onCancel,
  onSaved,
}: {
  entity: EntityName
  item: AnyItem | undefined
  onCancel: () => void
  onSaved: (name: string) => Promise<void>
}) {
  const creating = !item
  const [form, setForm] = useState<FormState>(() => initialState(entity, item))
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const formId = useId()

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError('')
    try {
      const saved = await request<AnyItem>(api(entity, item?.id), {
        method: creating ? 'POST' : 'PUT',
        body: JSON.stringify(toPayload(entity, form, creating)),
      })
      await onSaved(saved.name)
    } catch (error) {
      const issues = (error as { issues?: Errors }).issues
      if (issues) setErrors(issues)
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof FormState, label: string, input: ReactNode, hint?: string) => (
    <div className={`admin-field${errors[key] ? ' has-error' : ''}`}>
      <label htmlFor={`${formId}-${key}`}>{label}</label>
      {input}
      {hint && !errors[key] && <small>{hint}</small>}
      {errors[key] && (
        <small className="admin-error" role="alert">
          {errors[key]}
        </small>
      )}
    </div>
  )
  const text = (key: 'id' | 'name' | 'price' | 'image_url' | 'price_unit' | 'stock', extra: Record<string, unknown> = {}) => (
    <input
      id={`${formId}-${key}`}
      value={form[key]}
      onChange={event => set(key)(event.target.value)}
      aria-invalid={Boolean(errors[key])}
      {...extra}
    />
  )

  const preview = form.image_url.trim() || (item ? previewSrc(entity, item) : '')

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setErrors(prev => ({ ...prev, image_url: '' }))
    try {
      // Bolos: JPEG. Camadas e recheios: mantém o fundo transparente.
      const dataUrl = await prepareImage(file, { transparent: entity !== 'products' })
      const saved = await request<{ url: string }>('/api/images', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      })
      set('image_url')(saved.url)
      toast.success('Foto enviada. Toque em Salvar para usar no site.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a foto.'
      setErrors(prev => ({ ...prev, image_url: message }))
    } finally {
      setUploading(false)
    }
  }

  return (
    <form className="admin-form" onSubmit={submit} aria-labelledby={`${formId}-title`} noValidate>
      <div className="admin-form-head">
        <h3 id={`${formId}-title`}>
          {creating ? `Novo ${ENTITY_LABELS[entity].one.toLowerCase()}` : `Editar ${item?.name}`}
        </h3>
        <button type="button" onClick={onCancel} aria-label="Fechar formulário">
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="admin-form-grid">
        {field('name', 'Nome', text('name', { maxLength: 80, required: true }))}
        {field('price', 'Preço (R$)', text('price', { inputMode: 'decimal', placeholder: '0,00' }))}
        {creating &&
          field('id', 'Id (opcional)', text('id', { placeholder: 'gerado a partir do nome', maxLength: 60 }), 'Não muda depois: carrinhos e pedidos usam o id.')}

        {entity === 'products' && (
          <>
            {field(
              'category',
              'Categoria',
              <select id={`${formId}-category`} value={form.category} onChange={e => set('category')(e.target.value)}>
                <option value="festas">{CATEGORY_LABEL.festas}</option>
                <option value="cafes">{CATEGORY_LABEL.cafes}</option>
              </select>,
            )}
            {field('price_unit', 'Como é cobrado', text('price_unit', { placeholder: 'o quilo, até 13 fatias…' }))}
            {field(
              'unit',
              'Quantidade no carrinho',
              <select id={`${formId}-unit`} value={form.unit} onChange={e => set('unit')(e.target.value)}>
                <option value="kg">Por quilo (kg)</option>
                <option value="un">Por unidade</option>
              </select>,
            )}
            {field(
              'stock',
              form.unit === 'kg' ? 'Estoque (kg)' : 'Estoque (bolos)',
              text('stock', { inputMode: 'numeric', placeholder: 'vazio = sem controle' }),
              '0 = esgotado: o cliente só deixa pedido pendente. Vazio = sempre disponível.',
            )}
            <label className="admin-check">
              <input type="checkbox" checked={form.featured} onChange={e => set('featured')(e.target.checked)} /> Destaque no
              cardápio
            </label>
          </>
        )}

        {entity === 'layers' &&
          field(
            'category',
            'Etapa do Monte seu Bolo',
            <select id={`${formId}-category`} value={form.category} onChange={e => set('category')(e.target.value)}>
              <option value="base">{LAYER_LABELS.base}</option>
              <option value="cobertura">{LAYER_LABELS.cobertura}</option>
              <option value="decoracao">{LAYER_LABELS.decoracao}</option>
            </select>,
          )}

        {entity !== 'products' &&
          field(
            'badge',
            'Selo',
            <select id={`${formId}-badge`} value={form.badge} onChange={e => set('badge')(e.target.value)}>
              <option value="">Sem selo</option>
              <option value="popular">Mais pedido</option>
              <option value="premium">Premium</option>
            </select>,
          )}
      </div>

      {field(
        'description',
        'Descrição',
        <textarea
          id={`${formId}-description`}
          value={form.description}
          onChange={e => set('description')(e.target.value)}
          rows={3}
          maxLength={300}
        />,
      )}

      <div className="admin-form-image">
        <div className="admin-upload">
          <button
            type="button"
            className="admin-refresh"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-busy={uploading}
          >
            {uploading ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <ImageUp aria-hidden="true" />}
            {uploading ? 'Enviando foto…' : 'Enviar foto do celular ou computador'}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={upload} />
          {field(
            'image_url',
            'Ou cole o endereço da imagem (image_url)',
            text('image_url', { placeholder: 'https://… ou vazio para a foto padrão', inputMode: 'url' }),
            entity === 'products' ? undefined : 'Para o Monte seu Bolo, use PNG com fundo transparente.',
          )}
        </div>
        {preview && <img src={preview} alt="Prévia da imagem" width={72} height={72} />}
      </div>

      {formError && !Object.keys(errors).length && (
        <p className="admin-error" role="alert">
          {formError}
        </p>
      )}

      <div className="admin-form-actions">
        <button type="button" className="admin-logout" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="admin-submit" disabled={saving} aria-busy={saving}>
          {saving && <Loader2 aria-hidden="true" className="checkout-spin" />}
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

/* ---------- Estoque na lista ---------- */

function StockControl({
  product,
  busy,
  onChange,
}: {
  product: CatalogProduct
  busy: boolean
  onChange: (delta: number) => void
}) {
  const unit = product.unit === 'kg' ? 'kg' : product.stock === 1 ? 'bolo' : 'bolos'
  const label =
    product.stock === null ? 'Sem controle' : product.stock === 0 ? 'Esgotado' : `${product.stock} ${unit}`
  return (
    <div
      className={`admin-stock${product.stock === 0 ? ' is-out' : ''}`}
      role="group"
      aria-label={`Estoque de ${product.name}`}
      aria-busy={busy}
    >
      <button
        type="button"
        onClick={() => onChange(-1)}
        disabled={busy || product.stock === 0}
        aria-label={`Diminuir o estoque de ${product.name}`}
      >
        <Minus aria-hidden="true" />
      </button>
      <output aria-live="polite">{busy ? <Loader2 aria-hidden="true" className="checkout-spin" /> : label}</output>
      <button type="button" onClick={() => onChange(1)} disabled={busy} aria-label={`Aumentar o estoque de ${product.name}`}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  )
}
