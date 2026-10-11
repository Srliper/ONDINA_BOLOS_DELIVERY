import { useId, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import logo from '@/assets/ondina_logo.png'
import { initials, TEAM } from '@/data/team'
import { adminLogin } from '@/lib/admin-auth'

/** Entrada da administração: quem está entrando + senha (conferida no servidor). */
export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [memberId, setMemberId] = useState<string>(TEAM[0]?.id ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const passwordId = useId()
  const errorId = useId()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    if (!password) {
      setError('Digite a senha.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await adminLogin({ data: { memberId, password } })
      if (result.ok) {
        setPassword('')
        onSuccess()
      } else {
        setError(result.error)
      }
    } catch {
      setError('Não foi possível entrar agora. Confira a internet e tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login">
      <form className="admin-login-card" onSubmit={submit} noValidate>
        <img src={logo} alt="Ondina Bolos" className="admin-login-logo" width={72} height={72} />
        <p className="admin-eyebrow">
          <LockKeyhole aria-hidden="true" /> Área da equipe
        </p>
        <h1>Administração</h1>
        <p className="admin-login-hint">Acesso só para a família Ondina Bolos.</p>

        <fieldset className="admin-login-members">
          <legend>Quem está entrando?</legend>
          {TEAM.map(member => (
            <label key={member.id} className={`admin-member-choice${memberId === member.id ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="member"
                value={member.id}
                checked={memberId === member.id}
                onChange={() => setMemberId(member.id)}
                className="sr-only"
              />
              <span className="admin-member-avatar" aria-hidden="true">
                {member.photo ? <img src={member.photo} alt="" /> : initials(member.name)}
              </span>
              <span className="admin-member-name">{member.name.split(' ')[0]}</span>
            </label>
          ))}
        </fieldset>

        <label htmlFor={passwordId} className="admin-label">
          Senha
        </label>
        <div className="admin-password">
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            maxLength={200}
          />
          <button
            type="button"
            onClick={() => setShowPassword(value => !value)}
            aria-label={showPassword ? 'Esconder a senha' : 'Mostrar a senha'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
        {error && (
          <p id={errorId} className="admin-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="admin-submit" disabled={loading} aria-busy={loading}>
          {loading && <Loader2 aria-hidden="true" className="checkout-spin" />}
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        <a href="/" className="admin-back">
          Voltar para o site
        </a>
      </form>
    </main>
  )
}
