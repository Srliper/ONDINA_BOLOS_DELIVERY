import { describe, expect, it, vi } from 'vitest'
import { addSubscription, MAX_SUBSCRIPTIONS, pushFromEvent, pushFromSoldOut, pushSubscriptionSchema, removeSubscriptions } from '@/lib/push'
import { deliver } from '@/lib/push.server'

const sub = (n: number) => ({ endpoint: `https://push.example.com/${n}`, keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(12) } })

describe('aparelhos inscritos nas notificações', () => {
  it('guarda, atualiza sem repetir e limita', () => {
    let doc = addSubscription({ subscriptions: [] }, sub(1), 'ondina')
    doc = addSubscription(doc, sub(1), 'edgard')
    expect(doc.subscriptions).toHaveLength(1)
    expect(doc.subscriptions[0]?.memberId).toBe('edgard')
    for (let n = 2; n <= MAX_SUBSCRIPTIONS + 5; n++) doc = addSubscription(doc, sub(n), 'kaique')
    expect(doc.subscriptions).toHaveLength(MAX_SUBSCRIPTIONS)
    expect(removeSubscriptions(doc, [sub(MAX_SUBSCRIPTIONS + 5).endpoint]).subscriptions).toHaveLength(MAX_SUBSCRIPTIONS - 1)
  })

  it('só aceita endereço https do serviço de push', () => {
    expect(pushSubscriptionSchema.safeParse(sub(1)).success).toBe(true)
    expect(pushSubscriptionSchema.safeParse({ ...sub(1), endpoint: 'http://inseguro/1' }).success).toBe(false)
  })
})

describe('conteúdo das notificações', () => {
  it('pagamento aprovado vira "para entregar", abrindo o painel', () => {
    const payload = pushFromEvent({ event: 'pagamento-aprovado', orderId: 'OB-1', customer: 'Ana', total: 120 })
    expect(payload).toMatchObject({ title: expect.stringMatching(/para entregar/), url: '/admin', tag: 'pagamento-aprovado:OB-1' })
    expect(payload.body).toContain('OB-1')
    expect(pushFromSoldOut([{ id: 'prestigio', name: 'Prestígio' }]).body).toMatch(/Prestígio chegou a 0/)
  })
})

describe('envio', () => {
  it('manda para todos e devolve os aparelhos que saíram (404/410)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const subscriptions = [1, 2, 3, 4].map(n => ({ ...sub(n), memberId: 'ondina', createdAt: '' }))
    const sent: string[] = []
    const gone = await deliver(subscriptions, { title: 't', body: 'b', url: '/admin', tag: 'x' }, async subscription => {
      if (subscription.endpoint.endsWith('/2')) throw Object.assign(new Error('gone'), { statusCode: 410 })
      if (subscription.endpoint.endsWith('/3')) throw Object.assign(new Error('fora do ar'), { statusCode: 500 })
      sent.push(subscription.endpoint)
    })
    expect(sent).toHaveLength(2)
    expect(gone).toEqual([sub(2).endpoint])
    error.mockRestore()
  })
})
