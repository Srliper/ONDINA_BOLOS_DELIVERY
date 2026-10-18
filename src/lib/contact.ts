/** Contatos oficiais da Ondina (sem dependências, para evitar importações circulares). */
export const WHATSAPP_NUMBER = '5515997115450'

/** Endereço exato da loja, usado no link e no mapa incorporado. */
export const STORE_MAPS_QUERY = 'Rua Tapixi, 412 - Vila Tomaz, São Miguel Arcanjo - SP'

/** Link do Google Maps que abre direto no endereço exato (sem link curto, que pode apontar para outro ponto). */
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_MAPS_QUERY)}`
