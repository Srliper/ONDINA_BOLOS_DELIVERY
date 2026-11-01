import { describe, expect, it } from 'vitest'
import { paymentSetup } from '@/lib/payment-gateway'

describe('paymentSetup', () => {
  it('fica desligado sem token, mesmo com o banco ligado', () => {
    const setup = paymentSetup({}, true, 'https://ondinabolos.com')
    expect(setup.mode).toBe('desligado')
    expect(setup.enabled).toBe(false)
  })

  it('reconhece token de produção e de teste sem expor o valor', () => {
    const prod = paymentSetup({ token: 'APP_USR-123' }, true, 'https://ondinabolos.com/')
    expect(prod).toMatchObject({ mode: 'producao', enabled: true, publicUrl: true })
    expect(prod.webhookUrl).toBe('https://ondinabolos.com/api/payments/webhook')
    expect(JSON.stringify(prod)).not.toContain('APP_USR')
    expect(paymentSetup({ token: 'TEST-1' }, true, 'https://x.com').mode).toBe('teste')
  })

  it('exige o banco de pedidos e avisa quando o endereço não é https', () => {
    const setup = paymentSetup({ token: 'APP_USR-1', webhookSecret: ' ' }, false, 'http://localhost:3000')
    expect(setup).toMatchObject({ enabled: false, storage: false, publicUrl: false, webhookSecret: false })
  })
})
