import { Pool } from 'pg'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.warn('NEON_DATABASE_URL/DATABASE_URL not set')
}

const sql = connectionString ? neon(connectionString) : null

let pool
if (!globalThis._neonPool && connectionString) {
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })
  globalThis._neonPool = pool
} else {
  pool = globalThis._neonPool
}

export async function queryDatabase(text, params = []) {
  if (!pool) throw new Error('DB pool not initialized. Set NEON_DATABASE_URL.')
  const client = await pool.connect()
  try {
    const start = Date.now()
    const result = await client.query(text, params)
    const duration = Date.now() - start
    if (duration > 1000) console.log('Slow query:', { duration, rows: result.rowCount })
    return result
  } finally {
    client.release()
  }
}

export async function serverlessQuery(text, params = []) {
  const normalized = String(text || '').trim().toUpperCase()
  const isSelect = normalized.startsWith('SELECT')
  const isForUpdate = normalized.includes('FOR UPDATE')
  if (sql && isSelect && !isForUpdate) {
    const rows = await sql(text, params)
    return { rows, rowCount: rows.length }
  }
  const res = await queryDatabase(text, params)
  return { rows: res.rows, rowCount: res.rowCount }
}
