import { BUSINESS } from '@/lib/site'

/**
 * Regra de frete da Ondina:
 * - São Miguel Arcanjo → entrega com frete R$ 0,00 (ou retirada, se o cliente preferir);
 * - qualquer outra cidade → só "Retirada no Local", no endereço da loja.
 */

export const DELIVERY_CITY = 'São Miguel Arcanjo'
export const DELIVERY_FEE = 0
export const STORE_ADDRESS = `${BUSINESS.street} — ${BUSINESS.district}, ${BUSINESS.city} - ${BUSINESS.region}`

export type ShippingMethod = 'entrega' | 'retirada'

export interface ShippingOption {
  method: ShippingMethod
  label: string
  fee: number
  /** Endereço da loja, só na retirada. */
  address?: string
}

/** "São Miguel Arcanjo - SP", "sao miguel arcanjo/sp", "  SÃO  MIGUEL ARCANJO " → "sao miguel arcanjo". */
export function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[-/,]\s*sp$/, '')
}

export const isDeliveryCity = (city: string) => normalizeCity(city) === normalizeCity(DELIVERY_CITY)

const PICKUP: ShippingOption = { method: 'retirada', label: 'Retirada no Local', fee: 0, address: STORE_ADDRESS }
const DELIVERY: ShippingOption = { method: 'entrega', label: 'Entrega grátis', fee: DELIVERY_FEE }

/** Formas de receber disponíveis para a cidade informada. */
export function getShippingOptions(city: string): ShippingOption[] {
  return isDeliveryCity(city) ? [DELIVERY, PICKUP] : [PICKUP]
}

/** Frete cobrado (em reais) para a forma escolhida. */
export const shippingFee = (method: ShippingMethod): number => (method === 'entrega' ? DELIVERY_FEE : 0)
