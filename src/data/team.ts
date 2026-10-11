import ondinaPhoto from '@/assets/team/ondina.jpg'

export interface TeamMember {
  id: string
  name: string
  /** Cargo exibido no cartão. */
  role: string
  /** Parentesco/relação com a casa, em uma linha. */
  relation: string
  description: string
  instagram: string
  /** Foto de perfil quadrada; sem foto, o cartão mostra as iniciais. */
  photo?: string
}

const instagram = (handle: string) => `https://www.instagram.com/${handle}/`

/** Administração da Ondina Bolos, na ordem de exibição. */
export const TEAM: readonly TeamMember[] = [
  {
    id: 'ondina',
    name: 'Ondina Vieira',
    role: 'Proprietária e fundadora',
    relation: 'Dona da Ondina Bolos',
    description: 'Criou a Ondina Bolos em 2003 e cuida de cada receita, do recheio à decoração.',
    instagram: instagram('ondina.vieira'),
    photo: ondinaPhoto,
  },
  {
    id: 'edgard',
    name: 'Edgard Vieira',
    role: 'Sócio-proprietário',
    relation: 'Filho da Ondina',
    description: 'Divide com a Ondina a administração da casa, os pedidos e o atendimento.',
    instagram: instagram('edgard.nvieira'),
  },
  {
    id: 'kaique',
    name: 'Kaique',
    role: 'Gerente de Entregas',
    relation: 'Neto da Ondina',
    description: 'Organiza as rotas e leva os pedidos até você, com o bolo inteirinho.',
    instagram: instagram('kabn_2005'),
  },
]

/** "@ondina.vieira" a partir do link do perfil. */
export const instagramHandle = (url: string) => `@${url.replace(/\/+$/, '').split('/').pop()}`

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
