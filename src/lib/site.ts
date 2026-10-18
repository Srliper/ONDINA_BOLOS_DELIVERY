import { MAPS_URL, STORE_MAPS_QUERY, WHATSAPP_NUMBER } from '@/lib/contact'

/**
 * Dados institucionais num só lugar (SEO, rodapé, seção de localização).
 * Defina VITE_SITE_URL no provedor de deploy (ex.: https://ondinabolos.com.br)
 * para gerar URLs absolutas no Open Graph e o link canônico.
 */
export const SITE_URL = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') ?? ''

export const absoluteUrl = (path: string) => (SITE_URL && path.startsWith('/') ? `${SITE_URL}${path}` : path)

export const BUSINESS = {
  name: 'Ondina Bolos',
  phoneDisplay: '(15) 99711-5450',
  phoneE164: `+${WHATSAPP_NUMBER}`,
  street: 'Rua Tapixi, 412',
  district: 'Vila Tomaz',
  city: 'São Miguel Arcanjo',
  region: 'SP',
  mapsUrl: MAPS_URL,
  instagram: 'https://www.instagram.com/ondinabolos/',
  instagramHandle: '@ondinabolos',
  /** Mapa incorporado (não precisa de chave de API). */
  mapsEmbedUrl:
    'https://www.google.com/maps?q=' + encodeURIComponent(STORE_MAPS_QUERY) + '&output=embed',
  hours: [
    { label: 'Segunda a sexta', value: '07:00 às 18:00' },
    { label: 'Sábado', value: '07:00 às 20:00' },
    { label: 'Domingo', value: 'Fechado' },
  ],
} as const

/** Dados estruturados (schema.org) para o Google entender que é uma confeitaria local. */
export function bakeryJsonLd(image: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: BUSINESS.name,
    image: absoluteUrl(image),
    ...(SITE_URL && { url: SITE_URL }),
    telephone: BUSINESS.phoneE164,
    priceRange: 'R$',
    foundingDate: '2003',
    servesCuisine: 'Confeitaria',
    hasMap: BUSINESS.mapsUrl,
    sameAs: [BUSINESS.instagram],
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.street,
      addressLocality: BUSINESS.city,
      addressRegion: BUSINESS.region,
      addressCountry: 'BR',
    },
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:00', closes: '18:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '07:00', closes: '20:00' },
    ],
  }
}
