import { describe, expect, it } from 'vitest'
import { clearFailures, lockedFor, passwordMatches, readSession, registerFailure, signSession } from '@/lib/admin-session'

const SECRET = 'segredo-de-teste'

describe('sessão da administração', () => {
  it('aceita o próprio token e devolve quem entrou', async () => {
    const token = await signSession({ memberId: 'edgard', expiresAt: 2_000 }, SECRET)
    expect(await readSession(token, SECRET, 1_000)).toEqual({ memberId: 'edgard', expiresAt: 2_000 })
  })

  it('recusa token vencido, adulterado, de outro segredo ou de pessoa fora da equipe', async () => {
    const token = await signSession({ memberId: 'edgard', expiresAt: 2_000 }, SECRET)
    expect(await readSession(token, SECRET, 3_000)).toBeUndefined()
    expect(await readSession(token.replace('edgard', 'ondina'), SECRET, 1_000)).toBeUndefined()
    expect(await readSession(token.replace('.2000.', '.9999999.'), SECRET, 1_000)).toBeUndefined()
    expect(await readSession(token, 'outro-segredo', 1_000)).toBeUndefined()
    expect(await readSession(await signSession({ memberId: 'intruso', expiresAt: 2_000 }, SECRET), SECRET, 1_000)).toBeUndefined()
    expect(await readSession(undefined, SECRET)).toBeUndefined()
    expect(await readSession('lixo', SECRET)).toBeUndefined()
  })

  it('confere a senha exatamente (maiúsculas contam)', async () => {
    expect(await passwordMatches('senha-certa', 'senha-certa', SECRET)).toBe(true)
    expect(await passwordMatches('SENHA-CERTA', 'senha-certa', SECRET)).toBe(false)
    expect(await passwordMatches('', 'senha-certa', SECRET)).toBe(false)
  })

  it('bloqueia o IP depois de 5 erros seguidos, por 5 minutos', () => {
    const ip = '203.0.113.7'
    clearFailures(ip)
    for (let i = 0; i < 4; i++) registerFailure(ip, 0)
    expect(lockedFor(ip, 0)).toBe(0)
    registerFailure(ip, 0)
    expect(lockedFor(ip, 0)).toBe(5)
    expect(lockedFor(ip, 4 * 60_000)).toBe(1)
    expect(lockedFor(ip, 5 * 60_000 + 1)).toBe(0)
    clearFailures(ip)
  })
})
