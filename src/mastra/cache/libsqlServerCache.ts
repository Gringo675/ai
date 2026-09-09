import { MastraServerCache } from '@mastra/core/cache'
import { createClient, type Client } from '@libsql/client'
import path from 'path'
import fs from 'fs'

export interface LibSQLServerCacheOptions {
  /**
   * Optional pre-configured LibSQL client instance.
   * If provided, `url` and `authToken` are ignored.
   */
  client?: Client
  /**
   * Database URL. Defaults to 'file:./src/mastra/public/LibSQLStore/mastra.db'
   */
  url?: string
  /**
   * Auth token for remote LibSQL/Turso databases.
   */
  authToken?: string
  /**
   * Database table name used for caching. Defaults to 'mastra_response_cache'.
   */
  tableName?: string
  /**
   * Default TTL in milliseconds for cached items. Defaults to 300000 (5 minutes).
   */
  defaultTtlMs?: number
}

function normalizeDbUrl(url: string): string {
  if (url.startsWith('file:')) {
    const filePath = url.slice(5)
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath)

    const dir = path.dirname(absolutePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    return `file:${absolutePath}`
  }
  return url
}

export class LibSQLServerCache extends MastraServerCache {
  private client: Client
  private tableName: string
  private defaultTtlMs: number
  private initPromise: Promise<void> | null = null

  constructor(options: LibSQLServerCacheOptions = {}) {
    super({ name: 'LibSQLServerCache' })
    this.tableName = options.tableName ?? 'mastra_response_cache'
    this.defaultTtlMs = options.defaultTtlMs ?? 5 * 60 * 1000

    if (options.client) {
      this.client = options.client
    } else {
      const rawUrl = options.url ?? process.env.TURSO_DATABASE_URL ?? 'file:./src/mastra/public/LibSQLStore/mastra.db'
      const normalizedUrl = normalizeDbUrl(rawUrl)
      this.client = createClient({
        url: normalizedUrl,
        authToken: options.authToken ?? process.env.TURSO_AUTH_TOKEN,
      })
    }
  }

  private async ensureTable(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await this.client.execute(`
          CREATE TABLE IF NOT EXISTS ${this.tableName} (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            expires_at INTEGER
          )
        `)
      })()
    }
    return this.initPromise
  }

  async get(key: string): Promise<unknown> {
    await this.ensureTable()
    const now = Date.now()
    const result = await this.client.execute({
      sql: `SELECT value, expires_at FROM ${this.tableName} WHERE key = ?`,
      args: [key],
    })

    if (result.rows.length === 0) {
      return undefined
    }

    const row = result.rows[0]!
    const expiresAt = row.expires_at as number | null

    if (expiresAt !== null && expiresAt < now) {
      await this.delete(key)
      return undefined
    }

    try {
      return JSON.parse(row.value as string)
    } catch {
      return row.value
    }
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.ensureTable()
    const effectiveTtl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs
    const expiresAt = effectiveTtl > 0 ? Date.now() + effectiveTtl : null

    await this.client.execute({
      sql: `INSERT INTO ${this.tableName} (key, value, expires_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      args: [key, JSON.stringify(value), expiresAt],
    })
  }

  async delete(key: string): Promise<void> {
    await this.ensureTable()
    await this.client.execute({
      sql: `DELETE FROM ${this.tableName} WHERE key = ?`,
      args: [key],
    })
  }

  async clear(): Promise<void> {
    await this.ensureTable()
    await this.client.execute(`DELETE FROM ${this.tableName}`)
  }

  async increment(key: string): Promise<number> {
    await this.ensureTable()
    const current = await this.get(key)
    let counter: number
    if (current === undefined) {
      counter = 1
    } else if (typeof current === 'number') {
      counter = current + 1
    } else {
      throw new Error(`${key} exists but is not a number`)
    }
    await this.set(key, counter)
    return counter
  }

  async listLength(key: string): Promise<number> {
    const list = await this.get(key)
    if (list === undefined) {
      return 0
    }
    if (!Array.isArray(list)) {
      throw new Error(`${key} exists but is not an array`)
    }
    return list.length
  }

  async listPush(key: string, value: unknown): Promise<void> {
    const existing = await this.get(key)
    let list: unknown[]
    if (existing === undefined) {
      list = [value]
    } else if (Array.isArray(existing)) {
      list = existing
      list.push(value)
    } else {
      throw new Error(`${key} exists but is not an array`)
    }
    await this.set(key, list)
  }

  async listFromTo(key: string, from: number, to: number = -1): Promise<unknown[]> {
    const list = await this.get(key)
    if (Array.isArray(list)) {
      const endIndex = to === -1 ? undefined : to + 1
      return list.slice(from, endIndex)
    }
    return []
  }
}
