import { formatBRLPlain } from '@/lib/format'
import type { CartItem } from '@/types/product'

export const WHATSAPP_NUMBER = '5515997115450'
export const MAPS_URL = 'https://maps.app.goo.gl/DtPo1uTkxT1tYZCe9'

/** Texto exibido quando o cliente ainda não informou o endereço. */
export const ADDRESS_PLACEHOLDER = '(escreva aqui seu endereço completo)'

const whatsappUrl = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`

/** Mensagem do pedido no formato oficial (texto puro, ainda não codificado). */
export function buildOrderMessage(
  cartItems: readonly CartItem[],
  total: number,
  customerNote?: string,
  details?: { name?: string; payment?: string },
): string {
  const itemLines = cartItems.flatMap(item => {
    const subtotal = formatBRLPlain(item.price * item.quantity)
    if (item.type === 'ready') {
      return [`• ${item.quantity}x ${item.name}${item.product.unit === 'kg' ? ' (kg)' : ''} - ${subtotal}`]
    }
    const { base, recheio, cobertura, decoracao } = item.customConfig
    return [
      `• ${item.quantity}x ${item.name} - ${subtotal}`,
      `   Base: ${base}`,
      `   Recheio: ${recheio}`,
      `   Cobertura: ${cobertura}`,
      `   Decoração: ${decoracao}`,
    ]
  })
  const address = customerNote?.trim() || ADDRESS_PLACEHOLDER

  return [
    'Olá, Ondina Bolos! 🍰 Gostaria de fazer um pedido:',
    '',
    '📋 *Meu Pedido:*',
    ...itemLines,
    '',
    `💰 *Total Estimado: ${formatBRLPlain(total)}*`,
    '',
    ...(details?.name ? [`👤 *Nome:* ${details.name}`] : []),
    `📍 *Meu Endereço:* ${address}`,
    ...(details?.payment ? [`💳 *Pagamento:* ${details.payment}`] : []),
    `🗺️ *Ponto de Referência:* ${MAPS_URL}`,
  ].join('\n')
}

/** Link wa.me pronto para abrir a conversa com o pedido preenchido. */
export function generateWhatsAppLink(
  cartItems: readonly CartItem[],
  total: number,
  customerNote?: string,
  details?: { name?: string; payment?: string },
): string {
  return whatsappUrl(buildOrderMessage(cartItems, total, customerNote, details))
}

/** Link para dúvidas avulsas (sem carrinho), ex.: "Pedir agora" no topo. */
export function generateContactLink(productName?: string): string {
  return whatsappUrl(
    productName
      ? `Olá, Ondina Bolos! 🍰 Gostaria de pedir o bolo ${productName} e combinar tamanho, disponibilidade e entrega ou retirada.`
      : 'Olá, Ondina Bolos! 🍰 Gostaria de fazer um pedido e combinar entrega ou retirada.',
  )
}
