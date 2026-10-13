import { useEffect, useId, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import ondinaPhoto from '@/assets/team/ondina.jpg'
import { BUSINESS } from '@/lib/site'
import { WHATSAPP_NUMBER } from '@/lib/whatsapp'

const QUICK_MESSAGES = [
  { label: 'Quero encomendar um bolo', text: 'Olá, Ondina Bolos! Quero encomendar um bolo. Pode me ajudar?' },
  { label: 'Dúvida sobre entrega', text: 'Olá, Ondina Bolos! Tenho uma dúvida sobre a entrega.' },
  { label: 'Acompanhar meu pedido', text: 'Olá, Ondina Bolos! Quero acompanhar o meu pedido. O número é: ' },
] as const

const chatUrl = (text: string) =>
  `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(text)}`

/** Botão flutuante para o cliente conversar com o WhatsApp da loja, com mensagens prontas. */
export function WhatsAppWidget() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const panelId = useId()
  const inputId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Esc fecha e devolve o foco ao botão.
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const typed = message.trim()

  return (
    <div className="wa-widget">
      {open && (
        <div id={panelId} className="wa-panel" role="dialog" aria-label="Conversar com a Ondina Bolos no WhatsApp">
          <div className="wa-panel-head">
            <img src={ondinaPhoto} alt="" width={40} height={40} />
            <span>
              <strong>{BUSINESS.name}</strong>
              <small>Responde pelo WhatsApp · {BUSINESS.phoneDisplay}</small>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="wa-panel-body">
            <p className="wa-bubble">Olá! 👋 Que bolo vamos fazer hoje? Escolha uma opção ou escreva sua mensagem.</p>
            <ul className="wa-quick">
              {QUICK_MESSAGES.map(quick => (
                <li key={quick.label}>
                  <a href={chatUrl(quick.text)} target="_blank" rel="noreferrer">
                    {quick.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <form
            className="wa-compose"
            onSubmit={event => {
              event.preventDefault()
              if (!typed) return
              window.open(chatUrl(typed), '_blank', 'noopener,noreferrer')
              setMessage('')
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Sua mensagem
            </label>
            <input
              ref={inputRef}
              id={inputId}
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder="Escreva sua mensagem…"
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" aria-label="Enviar no WhatsApp" disabled={!typed}>
              <Send aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
      <button
        ref={toggleRef}
        type="button"
        className="wa-toggle"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Fechar conversa do WhatsApp' : 'Conversar no WhatsApp'}
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
      </button>
    </div>
  )
}
