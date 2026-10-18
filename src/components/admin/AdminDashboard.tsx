import { useState } from 'react'
import { ArrowUpRight, Copy, ExternalLink, Instagram, LogOut, MessageCircle, Store, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import logo from '@/assets/ondina_logo.png'
import { AdminNotifier } from '@/components/admin/AdminNotifier'
import { AdminOrders } from '@/components/admin/AdminOrders'
import { AdminStockDemand } from '@/components/admin/AdminStockDemand'
import { AdminTutorial } from '@/components/admin/AdminTutorial'
import { CatalogManager } from '@/components/admin/CatalogManager'
import { initials, instagramHandle, TEAM } from '@/data/team'
import { adminLogout } from '@/lib/admin-auth'
import { BUSINESS } from '@/lib/site'
import { generateContactLink, N8N_WEBHOOK_URL, WHATSAPP_NUMBER } from '@/lib/whatsapp'

const N8N_PANEL_URL = new URL(N8N_WEBHOOK_URL).origin
/** WhatsApp Web: abre a conta que estiver conectada neste computador (a da loja). */
const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/'

export function AdminDashboard({ memberId, onLogout }: { memberId: string; onLogout: () => void }) {
  const member = TEAM.find(person => person.id === memberId)
  const [leaving, setLeaving] = useState(false)

  const logout = async () => {
    setLeaving(true)
    try {
      await adminLogout()
    } finally {
      onLogout()
    }
  }

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(`+${WHATSAPP_NUMBER}`)
      toast.success('Número do WhatsApp copiado')
    } catch {
      toast.error('Não deu para copiar. O número é ' + BUSINESS.phoneDisplay)
    }
  }

  return (
    <div className="admin">
      <header className="admin-topbar">
        <a href="/" className="admin-brand">
          <img src={logo} alt="" width={40} height={40} />
          <span>
            <strong>Ondina Bolos</strong>
            <small>Administração</small>
          </span>
        </a>
        <div className="admin-user">
          {member && (
            <span className="admin-member-avatar is-small" aria-hidden="true">
              {member.photo ? <img src={member.photo} alt="" /> : initials(member.name)}
            </span>
          )}
          <button type="button" className="admin-logout" onClick={logout} disabled={leaving}>
            <LogOut aria-hidden="true" />
            Sair
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-hello">
          <h1>Olá, {member?.name.split(' ')[0] ?? 'equipe'}!</h1>
          <p>{member ? `${member.role} · ${member.relation}` : 'Bem-vindo à administração.'}</p>
        </section>

        <AdminNotifier />

        <AdminTutorial />

        <section className="admin-whatsapp" aria-labelledby="admin-whatsapp-title">
          <div className="admin-whatsapp-head">
            <MessageCircle aria-hidden="true" />
            <div>
              <h2 id="admin-whatsapp-title">WhatsApp da empresa</h2>
              <p>
                Os pedidos finalizados pelo WhatsApp chegam aqui: <strong>{BUSINESS.phoneDisplay}</strong>
              </p>
            </div>
          </div>
          <div className="admin-actions">
            <a className="admin-action is-primary" href={WHATSAPP_WEB_URL} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              Abrir conversas (WhatsApp Web)
            </a>
            <a className="admin-action" href={generateContactLink()} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Ver como o cliente chama
            </a>
            <button type="button" className="admin-action" onClick={copyNumber}>
              <Copy aria-hidden="true" />
              Copiar número
            </button>
          </div>
          <p className="admin-note">
            No WhatsApp Web, entre com o celular da loja (Aparelhos conectados → Conectar um aparelho). Cada pedido do
            site vem com um número como <strong>OB-…</strong>, o mesmo que fica registrado no n8n.
          </p>
        </section>

        <AdminOrders />

        <AdminStockDemand />

        <div className="admin-grid">
          <section className="admin-card" aria-labelledby="admin-orders-title">
            <h2 id="admin-orders-title">
              <Workflow aria-hidden="true" /> Pedidos (n8n)
            </h2>
            <p>Cada pedido enviado pelo site é registrado no n8n antes de abrir o WhatsApp.</p>
            <a className="admin-link" href={N8N_PANEL_URL} target="_blank" rel="noreferrer">
              Abrir o n8n <ArrowUpRight aria-hidden="true" />
            </a>
          </section>

          <section className="admin-card" aria-labelledby="admin-insta-title">
            <h2 id="admin-insta-title">
              <Instagram aria-hidden="true" /> Instagram
            </h2>
            <ul className="admin-list">
              <li>
                <a href={BUSINESS.instagram} target="_blank" rel="noreferrer">
                  {BUSINESS.instagramHandle}
                </a>
                <span>Loja</span>
              </li>
              {TEAM.map(person => (
                <li key={person.id}>
                  <a href={person.instagram} target="_blank" rel="noreferrer">
                    {instagramHandle(person.instagram)}
                  </a>
                  <span>{person.name.split(' ')[0]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-card" aria-labelledby="admin-team-title">
            <h2 id="admin-team-title">
              <Store aria-hidden="true" /> Equipe
            </h2>
            <ul className="admin-team">
              {TEAM.map(person => (
                <li key={person.id}>
                  <span className="admin-member-avatar is-small" aria-hidden="true">
                    {person.photo ? <img src={person.photo} alt="" /> : initials(person.name)}
                  </span>
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.role}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <CatalogManager />
      </main>
    </div>
  )
}
