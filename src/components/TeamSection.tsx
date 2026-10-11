import { ArrowUpRight, Instagram } from 'lucide-react'
import { initials, instagramHandle, TEAM, type TeamMember } from '@/data/team'
import { BUSINESS } from '@/lib/site'
import { stagger } from '@/lib/motion'

/** Administração da casa: quem é quem, com foto e Instagram de cada um. */
export function TeamSection() {
  return (
    <section className="team" id="administracao" aria-labelledby="team-title">
      <div className="bakery-container">
        <div className="team-heading" data-reveal>
          <p className="team-eyebrow">Administração</p>
          <h2 id="team-title">Uma família por trás de cada bolo</h2>
          <p>Três gerações cuidando da Ondina Bolos — da receita à sua porta.</p>
        </div>

        <ul className="team-grid">
          {TEAM.map((member, index) => (
            <TeamCard key={member.id} member={member} index={index} />
          ))}
        </ul>

        <a className="team-instagram" href={BUSINESS.instagram} target="_blank" rel="noreferrer" data-reveal>
          <Instagram aria-hidden="true" />
          <span>
            <strong>Siga {BUSINESS.instagramHandle}</strong>
            <small>Bolos da semana, encomendas e bastidores no Instagram</small>
          </span>
          <ArrowUpRight aria-hidden="true" className="team-instagram-arrow" />
        </a>
      </div>
    </section>
  )
}

function TeamCard({ member, index }: { member: TeamMember; index: number }) {
  const handle = instagramHandle(member.instagram)
  return (
    <li className="team-card" data-reveal style={stagger(index)}>
      <div className="team-avatar">
        {member.photo ? (
          <img src={member.photo} alt={`Foto de ${member.name}`} width={112} height={112} loading="lazy" decoding="async" />
        ) : (
          <span aria-hidden="true">{initials(member.name)}</span>
        )}
      </div>
      <p className="team-role">{member.role}</p>
      <h3>{member.name}</h3>
      <p className="team-relation">{member.relation}</p>
      <p className="team-description">{member.description}</p>
      <a
        className="team-link"
        href={member.instagram}
        target="_blank"
        rel="noreferrer"
        aria-label={`Instagram de ${member.name} (${handle})`}
      >
        <Instagram aria-hidden="true" />
        {handle}
      </a>
    </li>
  )
}
