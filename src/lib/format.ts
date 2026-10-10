const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "R$ 60,00" — com espaço não separável, ideal para a interface. */
export const formatBRL = (value: number): string => brl.format(value)

/** "R$ 60,00" com espaço comum, para textos enviados fora do navegador (WhatsApp). */
export const formatBRLPlain = (value: number): string => formatBRL(value).replace(/ /g, ' ')
