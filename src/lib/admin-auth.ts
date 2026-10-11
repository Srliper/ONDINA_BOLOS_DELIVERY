import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, getRequestIP, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  ADMIN_MEMBER_IDS,
  clearFailures,
  lockedFor,
  passwordMatches,
  readSession,
  registerFailure,
  signSession,
} from '@/lib/admin-session'

/**
 * Acesso da administração. Tudo aqui roda só no servidor (server functions):
 * - a senha fica na variável de ambiente ADMIN_PASSWORD — nunca no código nem no navegador;
 * - a sessão é um cookie httpOnly assinado com HMAC (expira em 12 h);
 * - tentativas erradas seguidas bloqueiam o IP por alguns minutos.
 */

const COOKIE = 'ondina_admin'
const SESSION_HOURS = 12

function settings() {
  const password = process.env['ADMIN_PASSWORD']
  if (!password) return undefined
  // Sem segredo próprio, deriva da senha: trocar a senha derruba todas as sessões.
  return { password, secret: process.env['ADMIN_SESSION_SECRET'] || `ondina-admin:${password}` }
}

/* ---------- Server functions usadas pela página /admin ---------- */

export type LoginResult = { ok: true; memberId: string } | { ok: false; error: string }

const loginSchema = z.object({
  memberId: z.enum(ADMIN_MEMBER_IDS),
  password: z.string().min(1, 'Digite a senha.').max(200),
})

export const adminLogin = createServerFn({ method: 'POST' })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<LoginResult> => {
    const config = settings()
    if (!config) return { ok: false, error: 'O acesso ainda não foi configurado no servidor (ADMIN_PASSWORD).' }

    const ip = getRequestIP({ xForwardedFor: true }) ?? 'desconhecido'
    const minutes = lockedFor(ip)
    if (minutes > 0) return { ok: false, error: `Muitas tentativas. Tente de novo em ${minutes} min.` }

    if (!(await passwordMatches(data.password, config.password, config.secret))) {
      registerFailure(ip)
      // Pequena espera deixa tentativa e erro automático bem mais lento.
      await new Promise(resolve => setTimeout(resolve, 500))
      return { ok: false, error: 'Senha incorreta.' }
    }

    clearFailures(ip)
    const session = { memberId: data.memberId, expiresAt: Date.now() + SESSION_HOURS * 3_600_000 }
    setCookie(COOKIE, await signSession(session, config.secret), {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_HOURS * 3600,
    })
    return { ok: true, memberId: data.memberId }
  })

export const getAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  const config = settings()
  if (!config) return null
  return (await readSession(getCookie(COOKIE), config.secret)) ?? null
})

export const adminLogout = createServerFn({ method: 'POST' }).handler(async () => {
  deleteCookie(COOKIE, { path: '/' })
  return { ok: true }
})
