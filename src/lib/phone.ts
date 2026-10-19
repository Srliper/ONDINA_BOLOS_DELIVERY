import { z } from 'zod'

/**
 * WhatsApp do cliente: aceita "(15) 99711-5450", "15997115450" ou "+55 15 99711-5450"
 * e guarda só os dígitos com o 55 na frente ("5515997115450"), pronto para o link wa.me.
 */

export const phoneSchema = z
  .string()
  .trim()
  .transform(value => value.replace(/\D/g, ''))
  .refine(digits => /^(55)?[1-9]{2}9?\d{8}$/.test(digits), 'Informe o WhatsApp com DDD (ex.: (15) 99711-5450).')
  .transform(digits => (digits.length <= 11 ? `55${digits}` : digits))

/** "5515997115450" → "(15) 99711-5450". */
export function formatPhone(phone: string): string {
  const local = phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(local)
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone
}

/** Conversa no WhatsApp com o cliente, com a mensagem pronta. */
export const customerWhatsAppUrl = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
