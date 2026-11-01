import { useEffect, useState } from 'react'
import { ArrowUpRight, BookOpen, CheckCircle2, CircleAlert, Copy, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { getPaymentSetup } from '@/lib/orders-server'
import type { PaymentSetup } from '@/lib/payment-gateway'

/** Atalhos da conta da loja no Mercado Pago (abrem com o login da loja). */
const MP_ACTIVITIES_URL = 'https://www.mercadopago.com.br/activities'
const MP_DEVELOPERS_URL = 'https://www.mercadopago.com.br/developers/panel/app'

const MODE_LABEL: Record<PaymentSetup['mode'], string> = {
  producao: 'Ligado — cobrando de verdade',
  teste: 'Modo teste — nada é cobrado',
  desligado: 'Desligado',
}

/** Abre a lição do tutorial e rola até ela. */
function openLesson(id: string) {
  const lesson = document.getElementById(`tutorial-${id}`)
  if (!(lesson instanceof HTMLDetailsElement)) return
  lesson.open = true
  lesson.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Quadro do Mercado Pago no painel: se o pagamento pelo site está ligado, o que falta e os atalhos. */
export function AdminPayments() {
  const [setup, setSetup] = useState<PaymentSetup>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    getPaymentSetup()
      .then(result => {
        if (!active) return
        if (result.ok) setSetup(result.setup)
        else setFailed(true)
      })
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [])

  const copyWebhook = async () => {
    if (!setup) return
    try {
      await navigator.clipboard.writeText(setup.webhookUrl)
      toast.success('Endereço do aviso copiado')
    } catch {
      toast.error('Não deu para copiar. O endereço é ' + setup.webhookUrl)
    }
  }

  const checks: { ok: boolean; label: string; hint: string }[] = setup
    ? [
        {
          ok: setup.mode !== 'desligado',
          label: 'Access Token do Mercado Pago',
          hint:
            setup.mode === 'desligado'
              ? 'Falta MERCADOPAGO_ACCESS_TOKEN na Vercel.'
              : setup.mode === 'teste'
                ? 'Token de teste (TEST-…): troque pelo de produção (APP_USR-…) para receber de verdade.'
                : 'Token de produção configurado.',
        },
        {
          ok: setup.storage,
          label: 'Banco de pedidos',
          hint: setup.storage ? 'Conectado.' : 'Conecte o Upstash Redis na Vercel (veja o README).',
        },
        {
          ok: setup.publicUrl,
          label: 'Endereço do site',
          hint: setup.publicUrl
            ? setup.siteUrl
            : `${setup.siteUrl} — precisa ser https:// para o cliente voltar sozinho ao site depois de pagar.`,
        },
        {
          ok: setup.webhookSecret,
          label: 'Aviso de pagamento (webhook)',
          hint: setup.webhookSecret
            ? 'Assinatura secreta configurada.'
            : 'Opcional: cadastre o endereço abaixo no Mercado Pago e coloque a assinatura em MERCADOPAGO_WEBHOOK_SECRET.',
        },
      ]
    : []

  return (
    <section className="admin-card admin-payments" aria-labelledby="admin-payments-title">
      <h2 id="admin-payments-title">
        <CreditCard aria-hidden="true" /> Pagamento online (Mercado Pago)
      </h2>

      {!setup && !failed && <p className="admin-muted">Conferindo…</p>}
      {failed && <p className="admin-muted">Não deu para conferir agora. Atualize a página.</p>}

      {setup && (
        <>
          <p className={`admin-payments-mode is-${setup.enabled ? setup.mode : 'desligado'}`} role="status">
            {setup.enabled ? MODE_LABEL[setup.mode] : MODE_LABEL.desligado}
          </p>
          <p className="admin-muted">
            {setup.enabled
              ? 'No checkout, o cliente vê “Pagar aqui no site” e paga com Pix ou cartão na página segura do Mercado Pago. O dinheiro cai na conta da loja.'
              : 'O checkout mostra “Pagar aqui no site — Indisponível no momento” e o cliente finaliza pelo WhatsApp.'}
          </p>

          <ul className="admin-payments-checks">
            {checks.map(check => (
              <li key={check.label} className={check.ok ? 'is-ok' : 'is-missing'}>
                {check.ok ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
                <span>
                  <strong>{check.label}</strong>
                  <small>{check.hint}</small>
                </span>
              </li>
            ))}
          </ul>

          {setup.publicUrl && (
            <p className="admin-payments-webhook">
              <span>Endereço do aviso:</span>
              <code>{setup.webhookUrl}</code>
              <button type="button" className="admin-action" onClick={copyWebhook}>
                <Copy aria-hidden="true" /> Copiar
              </button>
            </p>
          )}
        </>
      )}

      <div className="admin-actions">
        <a className="admin-action is-primary" href={MP_ACTIVITIES_URL} target="_blank" rel="noreferrer">
          <ArrowUpRight aria-hidden="true" />
          Ver pagamentos recebidos
        </a>
        <a className="admin-action" href={MP_DEVELOPERS_URL} target="_blank" rel="noreferrer">
          <ArrowUpRight aria-hidden="true" />
          Credenciais e webhook
        </a>
        <button type="button" className="admin-action" onClick={() => openLesson('cliente-paga')}>
          <BookOpen aria-hidden="true" />
          Como o cliente paga
        </button>
        <button type="button" className="admin-action" onClick={() => openLesson('mercado-pago')}>
          <BookOpen aria-hidden="true" />
          Usar o Mercado Pago
        </button>
      </div>
      <p className="admin-note">
        Os atalhos abrem o site do Mercado Pago: entre com a conta da loja (a mesma do Access Token).
      </p>
    </section>
  )
}
