import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'

const dbPaths = [
  './src/mastra/public/src/mastra/public/LibSQLStore/mastra.db',
  './src/mastra/public/LibSQLStore/mastra.db',
]

const targetArg = process.argv[2]
const clearAll = !targetArg || targetArg === '--all'
const agentName = clearAll ? null : targetArg

let totalAffected = 0

for (const relativePath of dbPaths) {
  const fullPath = path.resolve(relativePath)
  if (!fs.existsSync(fullPath)) continue

  const client = createClient({ url: `file:${fullPath}` })
  try {
    let sql = 'DELETE FROM mastra_response_cache'
    const args = []

    if (!clearAll && agentName) {
      sql += ' WHERE key LIKE ?'
      args.push(`mastra:agent-response:${agentName}:%`)
    }

    const res = await client.execute({ sql, args })
    totalAffected += res.rowsAffected
    console.log(
      `[Cache] ${relativePath}: удалено записей: ${res.rowsAffected}${
        agentName ? ` (агент: "${agentName}")` : ' (полная очистка)'
      }`,
    )
  } catch (err) {
    if (err.message?.includes('no such table')) continue
    console.error(`[Cache] Ошибка при обработке ${relativePath}:`, err)
  }
}

console.log(`[Cache] Всего удалено записей: ${totalAffected}`)
