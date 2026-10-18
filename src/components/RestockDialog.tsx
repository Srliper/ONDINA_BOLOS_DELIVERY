import { useId, useState, type FormEvent } from 'react'
import { BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { phoneSchema } from '@/lib/phone'
import type { Product } from '@/types/product'

/**
 * "Avise-me quando chegar" num bolo esgotado: o cliente deixa nome e WhatsApp e a equipe vê no
 * painel quantas pessoas esperam esse bolo, com o contato para avisar.
 */
export function RestockDialog({ product, open, onOpenChange }: { product: Product; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState(false)
  const formId = useId()
  const unit = product.unit === 'kg' ? 'kg' : 'unidades'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (sending) return
    if (name.trim().length < 2) return setError('Informe seu nome.')
    if (!phoneSchema.safeParse(phone).success) return setError('Informe o WhatsApp com DDD (ex.: (15) 99711-5450).')
    const amount = quantity.trim() ? Number(quantity) : undefined
    if (amount !== undefined && (!Number.isInteger(amount) || amount < 1 || amount > 50)) {
      return setError(`Use um número de 1 a 50 ${unit}.`)
    }
    setError(undefined)
    setSending(true)
    try {
      const { requestRestock } = await import('@/lib/stock-requests-server')
      const result = await requestRestock({
        data: { productId: product.id, name, phone, ...(amount ? { quantity: amount } : {}) },
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(`Combinado! Avisamos no seu WhatsApp quando o ${product.name} chegar.`)
      onOpenChange(false)
    } catch {
      setError('Não foi possível registrar agora. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="restock-dialog">
        <DialogHeader>
          <DialogTitle className="restock-title">
            <BellRing aria-hidden="true" /> Avise-me quando chegar
          </DialogTitle>
          <DialogDescription>
            O <strong>{product.name}</strong> está com estoque 0 agora. Deixe seu WhatsApp: a Ondina avisa assim que
            tiver de novo.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} className="restock-form" onSubmit={submit} noValidate>
          <label>
            Seu nome
            <input value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={60} required />
          </label>
          <label>
            Seu WhatsApp
            <input
              type="tel"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              autoComplete="tel-national"
              inputMode="tel"
              maxLength={20}
              placeholder="(15) 99999-9999"
              required
            />
          </label>
          <label>
            Quanto você quer? <span>(opcional, em {unit})</span>
            <input value={quantity} onChange={event => setQuantity(event.target.value)} inputMode="numeric" maxLength={2} />
          </label>
          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="add-button" disabled={sending} aria-busy={sending}>
            {sending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <BellRing aria-hidden="true" />}
            {sending ? 'Registrando…' : 'Quero ser avisado'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
