/**
 * Depoimentos REAIS de clientes (copie de avaliações do Google, Instagram ou WhatsApp,
 * com autorização de quem escreveu). A seção "O que dizem nossos clientes" só aparece
 * no site quando houver pelo menos um item aqui — nunca publique depoimentos inventados.
 *
 * Exemplo de formato:
 * { quote: 'Texto da avaliação, como o cliente escreveu.', author: 'Nome do cliente', source: 'Google' }
 */
export interface Testimonial {
  quote: string
  author: string
  /** Onde a avaliação foi publicada, ex.: "Google", "Instagram". */
  source?: string
}

export const testimonials: readonly Testimonial[] = []
