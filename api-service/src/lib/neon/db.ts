import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.warn('DATABASE_URL not set')
}

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: { rejectUnauthorized: false },
    })
  : null

export async function q<T = any>(text: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
  if (!pool) throw new Error('DB pool not initialized. Set DATABASE_URL.')
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return { rows: res.rows as T[], rowCount: res.rowCount }
  } finally {
    client.release()
  }
}
