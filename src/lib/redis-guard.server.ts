import { CatalogError } from '@/lib/catalog'
import { upstashCommand, upstashConfig } from '@/lib/catalog-store'

/**
 * Proteções que valem entre todas as cópias do site no ar (a Vercel pode rodar várias ao
 * mesmo tempo): a trava de gravação e o limite de pedidos por pessoa ficam no Upstash Redis.
 * Sem Upstash (no computador), valem só dentro deste processo — o que basta com um servidor só.
 */

export type RedisCommand = (args: string[]) => Promise<unknown>

const redis = (): RedisCommand | undefined => {
  const config = upstashConfig()
  return config ? upstashCommand(config.url, config.token) : undefined
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Apaga a trava só se ainda for nossa (outra cópia pode ter pegado depois de expirar). */
const RELEASE_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"

export class BusyError extends CatalogError {
  constructor() {
    super(503, 'Muita gente comprando agora. Tente de novo em alguns segundos.')
    this.name = 'BusyError'
  }
}

/**
 * Uma gravação de cada vez (ler → mudar → gravar), em todas as cópias do site. Assim dois
 * clientes nunca levam o mesmo último bolo. A trava expira sozinha (ttlMs) se uma cópia cair.
 */
export function createWriteLock(
  command: RedisCommand | undefined,
  { key = 'ondina:lock:write', ttlMs = 15_000, waitMs = 8_000 } = {},
) {
  let queue: Promise<unknown> = Promise.resolve()

  const acquire = async (): Promise<string | undefined> => {
    if (!command) return undefined
    const token = crypto.randomUUID()
    const deadline = Date.now() + waitMs
    for (;;) {
      if ((await command(['SET', key, token, 'NX', 'PX', String(ttlMs)])) === 'OK') return token
      if (Date.now() >= deadline) throw new BusyError()
      await sleep(40 + Math.random() * 80)
    }
  }

  const release = async (token: string | undefined) => {
    if (!command || !token) return
    try {
      await command(['EVAL', RELEASE_SCRIPT, '1', key, token])
    } catch (error) {
      // Sem problema: a trava expira sozinha.
      console.error('[trava] não deu para liberar agora', error)
    }
  }

  return function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      const token = await acquire()
      try {
        return await task()
      } finally {
        await release(token)
      }
    })
    queue = run.catch(() => undefined)
    return run
  }
}

export const exclusive = createWriteLock(redis())

/**
 * Limite contra abuso: no máximo `max` ações por chave (ex.: IP) a cada `windowMs`.
 * Conta no Redis; se o Redis falhar, conta na memória (nunca bloqueia por erro do banco).
 */
export function createRateLimit(max: number, windowMs: number, name: string, command: RedisCommand | undefined = redis()) {
  const memory = new Map<string, number[]>()
  const inMemory = (key: string, now: number) => {
    const recent = (memory.get(key) ?? []).filter(at => now - at < windowMs)
    recent.push(now)
    memory.set(key, recent)
    return recent.length > max
  }
  return async (key: string, now = Date.now()): Promise<boolean> => {
    if (!command) return inMemory(key, now)
    const bucket = `ondina:limite:${name}:${key}:${Math.floor(now / windowMs)}`
    try {
      const count = Number(await command(['INCR', bucket]))
      if (count === 1) await command(['PEXPIRE', bucket, String(windowMs)])
      return count > max
    } catch (error) {
      console.error('[limite] Redis indisponível; contando na memória', error)
      return inMemory(key, now)
    }
  }
}
