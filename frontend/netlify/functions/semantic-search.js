import { z } from 'zod'
import OpenAI from 'openai'
import { serverlessQuery } from './neon-client.js'

const qSchema = z.object({
  q: z.string().min(1),
  limit: z.string().optional(),
})

function toVectorLiteral(arr) {
  return '[' + arr.map((n) => Number(n).toFixed(6)).join(',') + ']'
}

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  try {
    const parsed = qSchema.safeParse(event.queryStringParameters || {})
    if (!parsed.success) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing q' }) }

    const { q, limit = '10' } = parsed.data
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'OPENAI_API_KEY not set' }) }

    const client = new OpenAI({ apiKey })
    const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

    const emb = await client.embeddings.create({ model: embeddingModel, input: q })
    const vector = emb.data?.[0]?.embedding
    if (!vector) throw new Error('No embedding returned')

    const vectorLiteral = toVectorLiteral(vector)

    const sql = `
      SELECT id, document_id, title, release_date,
             1 - (content_vector <=> $1::vector) AS similarity
      FROM documents
      WHERE content_vector IS NOT NULL
      ORDER BY content_vector <=> $1::vector
      LIMIT $2
    `
    const result = await serverlessQuery(sql, [vectorLiteral, limitNum])

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result.rows }) }
  } catch (err) {
    console.error(err)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Internal server error', requestId: context.awsRequestId }) }
  }
}
