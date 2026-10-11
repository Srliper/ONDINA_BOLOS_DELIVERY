import { TEAM } from '@/data/team'

/** Sessão, senha e bloqueio da administração — funções puras (Web Crypto), testáveis. */

const MAX_FAILURES = 5
const LOCK_MINUTES = 5

export const ADMIN_MEMBER_IDS = TEAM.map(member => member.id) as [string, ...string[]]

export interface AdminSession {
  memberId: string
  expiresAt: number
}

const encoder = new TextEncoder()

const base64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

/** Comparação em tempo constante (não vaza, pelo tempo, quantos caracteres batem). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signSession(session: AdminSession, secret: string): Promise<string> {
  const payload = `${session.memberId}.${session.expiresAt}`
  return `${payload}.${await hmac(secret, payload)}`
}

export async function readSession(token: string | undefined, secret: string, now = Date.now()) {
  if (!token) return undefined
  const [memberId, expires, signature] = token.split('.')
  if (!memberId || !expires || !signature) return undefined
  const expected = await hmac(secret, `${memberId}.${expires}`)
  const expiresAt = Number(expires)
  if (!safeEqual(signature, expected) || !Number.isFinite(expiresAt) || expiresAt < now) return undefined
  if (!ADMIN_MEMBER_IDS.includes(memberId)) return undefined
  return { memberId, expiresAt } satisfies AdminSession
}

export async function passwordMatches(input: string, password: string, secret: string): Promise<boolean> {
  // Compara os HMACs (mesmo tamanho), não as senhas em texto.
  return safeEqual(await hmac(secret, input), await hmac(secret, password))
}

/* ---------- Bloqueio por tentativas erradas (memória do servidor) ---------- */

const failures = new Map<string, { count: number; lockedUntil: number }>()

export function lockedFor(ip: string, now = Date.now()): number {
  const entry = failures.get(ip)
  return entry && entry.lockedUntil > now ? Math.ceil((entry.lockedUntil - now) / 60_000) : 0
}

export function registerFailure(ip: string, now = Date.now()): void {
  const entry = failures.get(ip) ?? { count: 0, lockedUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_FAILURES) {
    entry.count = 0
    entry.lockedUntil = now + LOCK_MINUTES * 60_000
  }
  failures.set(ip, entry)
}

export const clearFailures = (ip: string) => failures.delete(ip)
