import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q } from '../../lib/neon/db.js'

const listSchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function documentsRoutes(app: FastifyInstance) {
  app.get('/v2/documents', async (req, reply) => {
    const parsed = listSchema.safeParse((req.query as any) || {})
    if (!parsed.success) return reply.code(400).send({ error: 'Bad query' })

    const { q: search, limit, offset } = parsed.data
    const params: any[] = []
    let p = 0

    let sql = `
      SELECT id, document_id, title, document_type, release_date, source_url
      FROM documents
      WHERE 1=1
    `
    if (search) {
      p++
      sql += ` AND (title ILIKE $${p} OR content ILIKE $${p})`
      params.push(`%${search}%`)
    }
    p++
    sql += ` ORDER BY release_date DESC NULLS LAST LIMIT $${p}`
    params.push(limit)
    p++
    sql += ` OFFSET $${p}`
    params.push(offset)

    const res = await q(sql, params)
    return { success: true, data: res.rows }
  })
}
