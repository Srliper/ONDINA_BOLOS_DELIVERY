import { useMemo, useState } from 'react'
import { MessageCircle, ArrowUpRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { partyFlavors, coffeeFlavors, simpleFlavors, portions } from '@/lib/bakery-menu'

const types = [
  { id: 'festa', label: 'Bolo de festa', hint: 'R$ 60,00 o kg', flavors: partyFlavors },
  { id: 'cafe', label: 'Bolo de café', hint: 'R$ 25,00 · até 13 fatias', flavors: coffeeFlavors },
  { id: 'simples', label: 'Bolo simples', hint: 'R$ 20,00', flavors: simpleFlavors },
] as const
// Valores de exemplo — substituir pelos fretes reais da Ondina
const zones = [
  { id: 'centro', label: 'Centro e perímetro urbano', fee: 0 },
  { id: 'bairros', label: 'Bairros afastados', fee: 8 },
  { id: 'rural', label: 'Bairros rurais próximos', fee: 15 },
]
const kg: Record<string, number> = { '1 kg': 1, '1,5 kg': 1.5, '2 kg': 2, '3 kg': 3, '4 kg': 4 }
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CakeBuilder() {
  const [type, setType] = useState<(typeof types)[number]['id']>('festa')
  const [flavor, setFlavor] = useState('')
  const [size, setSize] = useState('1 kg')
  const [delivery, setDelivery] = useState<'entrega' | 'retirada'>('entrega')
  const [zone, setZone] = useState('centro')
  const [box, setBox] = useState(false)
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const fee = delivery === 'entrega' ? zones.find(z => z.id === zone)!.fee : 0
  const current = types.find(t => t.id === type)!

  const total = useMemo(() => (type === 'festa' ? 60 * (kg[size] ?? 1) : type === 'cafe' ? 25 : 20) + (box ? 10 : 0) + fee, [type, size, box, fee])

  const link = useMemo(() => {
    const lines = [
      'Olá Ondina Bolos 🍰! Montei meu bolo pelo site:',
      `• Tipo: ${current.label}`,
      `• Sabor: ${flavor || 'a combinar'}`,
      type === 'festa' ? `• Tamanho: ${size} (${portions.find(p => p.weight === size)?.people.toLowerCase()})` : '',
      `• ${delivery === 'entrega' ? `Entrega: ${zones.find(z => z.id === zone)!.label} (frete ${fee ? brl(fee) : 'grátis'})` : 'Retirada na Rua Tapixi, 412'}`,
      box ? '• Com caixa para viagem' : '',
      date ? `• Para: ${date.split('-').reverse().join('/')}` : '',
      name ? `• Nome: ${name}` : '',
      notes ? `• Observações: ${notes}` : '',
      `Valor estimado: ${brl(total)}`,
    ].filter(Boolean)
    return `https://api.whatsapp.com/send?phone=5515997115450&text=${encodeURIComponent(lines.join('\n'))}`
  }, [current, flavor, type, size, delivery, zone, fee, box, date, name, notes, total])

  return (
    <section className="builder" id="monte" aria-labelledby="builder-title">
      <div className="bakery-container builder-grid">
        <div className="builder-steps">
          <p className="builder-eyebrow">Monte seu bolo</p>
          <h2 id="builder-title">Do seu jeito, em poucos passos.</h2>

          <fieldset><legend>1. Tipo de bolo</legend>
            <div className="chip-row">{types.map(t => (
              <button type="button" key={t.id} className={`choice ${type === t.id ? 'is-on' : ''}`} onClick={() => { setType(t.id); setFlavor('') }}>
                <strong>{t.label}</strong><span>{t.hint}</span>
              </button>))}</div>
          </fieldset>

          <fieldset><legend>2. Sabor</legend>
            <div className="flavor-pick">{current.flavors.map(f => (
              <button type="button" key={f.name} title={f.description} className={`chip ${flavor === f.name ? 'is-on' : ''}`} onClick={() => setFlavor(f.name)}>{f.name}</button>))}</div>
            {flavor && current.flavors.find(f => f.name === flavor)?.description && <p className="builder-desc">{current.flavors.find(f => f.name === flavor)?.description}</p>}
          </fieldset>

          {type === 'festa' && <fieldset><legend>3. Tamanho</legend>
            <div className="chip-row">{portions.map(p => (
              <button type="button" key={p.weight} className={`choice ${size === p.weight ? 'is-on' : ''}`} onClick={() => setSize(p.weight)}>
                <strong>{p.weight}</strong><span>{p.people}</span>
              </button>))}</div>
          </fieldset>}

          <fieldset><legend>{type === 'festa' ? '4' : '3'}. Entrega</legend>
            <div className="chip-row">
              <button type="button" className={`choice ${delivery === 'entrega' ? 'is-on' : ''}`} onClick={() => setDelivery('entrega')}><strong>Entrega</strong><span>Frete conforme a região da cidade</span></button>
              <button type="button" className={`choice ${delivery === 'retirada' ? 'is-on' : ''}`} onClick={() => setDelivery('retirada')}><strong>Retirada</strong><span>Rua Tapixi, 412 — Vila Tomaz</span></button>
            </div>
            {delivery === 'entrega' && <div className="flavor-pick zone-pick">{zones.map(z => (
              <button type="button" key={z.id} className={`chip ${zone === z.id ? 'is-on' : ''}`} onClick={() => setZone(z.id)}>{z.label} · {z.fee ? brl(z.fee) : 'Grátis'}</button>))}</div>}
            <label className="check"><input type="checkbox" checked={box} onChange={e => setBox(e.target.checked)} /> Caixa para viagem (+ R$ 10,00)</label>
          </fieldset>

          <fieldset><legend>{type === 'festa' ? '5' : '4'}. Detalhes</legend>
            <div className="field-row">
              <label>Para quando?<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
              <label>Seu nome<input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Como podemos te chamar" /></label>
            </div>
            <label>Observações<textarea value={notes} maxLength={300} onChange={e => setNotes(e.target.value)} placeholder="Ex.: escrever “Feliz aniversário, Ana”" /></label>
          </fieldset>
        </div>

        <aside className="builder-summary" aria-live="polite">
          <h3>Seu bolo</h3>
          <ul>
            <li><Check size={15} />{current.label}</li>
            <li><Check size={15} />{flavor || 'Escolha um sabor'}</li>
            {type === 'festa' && <li><Check size={15} />{size} · {portions.find(p => p.weight === size)?.people}</li>}
            <li><Check size={15} />{delivery === 'entrega' ? `Frete: ${fee ? brl(fee) : 'grátis'}` : 'Retirada'}</li>
            {box && <li><Check size={15} />Caixa para viagem</li>}
          </ul>
          <p className="summary-label">Valor estimado</p>
          <p className="summary-total">{brl(total)}</p>
          <Button asChild variant="bakery"><a href={link} target="_blank" rel="noreferrer" aria-disabled={!flavor} onClick={e => { if (!flavor) e.preventDefault() }}><MessageCircle />Enviar pedido<ArrowUpRight /></a></Button>
          {!flavor && <p className="summary-hint">Escolha um sabor para enviar.</p>}
          <p className="summary-hint">O pedido é confirmado pelo WhatsApp.</p>
        </aside>
      </div>
    </section>
  )
}
