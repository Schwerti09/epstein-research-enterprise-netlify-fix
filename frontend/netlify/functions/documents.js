import { z } from 'zod'
import { serverlessQuery } from './neon-client.js'

const querySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  q: z.string().optional(),
  filters: z.string().optional(),
})

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  try {
    const apiKey = event.headers['x-api-key'] || ''
    const parsed = querySchema.safeParse(event.queryStringParameters || {})
    if (!parsed.success) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Bad params' }) }

    const { page = '1', limit = '20', q = '', filters = '{}' } = parsed.data
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const offset = (pageNum - 1) * limitNum
    const filterObj = JSON.parse(filters || '{}') || {}

    const rateLimit = await checkRateLimit(apiKey)
    if (!rateLimit.allowed) {
      return { statusCode: 429, headers, body: JSON.stringify({ success: false, error: 'Rate limit exceeded', retryAfter: rateLimit.reset }) }
    }

    let sql = `
      SELECT 
        d.id,
        d.document_id,
        d.title,
        d.document_type,
        d.release_date,
        d.source_url,
        COALESCE(da.summary, '') as ai_summary,
        COUNT(*) OVER() as total_count
      FROM documents d
      LEFT JOIN document_analyses da 
        ON d.id = da.document_id 
       AND da.analysis_version = 'v2.0'
      WHERE 1=1
    `
    const params = []
    let p = 0

    if (q) {
      p++
      sql += ` AND (
        d.title ILIKE $${p}
        OR d.content ILIKE $${p}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(da.key_entities,'[]'::jsonb)) entity
          WHERE (entity->>'name') ILIKE $${p}
        )
      )`
      params.push(`%${q}%`)
    }

    if (filterObj.documentType) {
      p++
      sql += ` AND d.document_type = $${p}`
      params.push(filterObj.documentType)
    }

    if (filterObj.dateFrom) {
      p++
      sql += ` AND d.release_date >= $${p}`
      params.push(filterObj.dateFrom)
    }

    sql += ` ORDER BY d.release_date DESC NULLS LAST`

    p++
    sql += ` LIMIT $${p}`
    params.push(limitNum)

    p++
    sql += ` OFFSET $${p}`
    params.push(offset)

    const result = await serverlessQuery(sql, params)
    await trackApiUsage(apiKey, 'documents.list', result.rows.length)

    const total = result.rows?.[0]?.total_count || 0

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result.rows,
        pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
        rateLimit: { remaining: rateLimit.remaining, reset: rateLimit.reset },
        requestId: context.awsRequestId,
      }),
    }
  } catch (error) {
    console.error('API Error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Internal server error', requestId: context.awsRequestId }) }
  }
}

async function checkRateLimit(apiKey) {
  // Template-Stub: In Produktion Redis/Upstash etc.
  const limit = apiKey ? 1000 : 100
  return { allowed: true, remaining: limit - 1, reset: new Date(Date.now() + 3600000).toISOString() }
}

async function trackApiUsage(apiKey, endpoint, documentCount = 0) {
  if (!apiKey) return
  const q = `
    INSERT INTO api_usage (api_key, endpoint, request_count, document_count, tier)
    VALUES ($1, $2, 1, $3,
      CASE WHEN $1 LIKE 'pk_live_%' THEN 'enterprise'
           WHEN $1 LIKE 'pk_test_%' THEN 'development'
           ELSE 'free' END)
    ON CONFLICT (api_key, endpoint, usage_day)
    DO UPDATE SET request_count = api_usage.request_count + 1,
                  document_count = api_usage.document_count + EXCLUDED.document_count;
  `
  await serverlessQuery(q, [apiKey, endpoint, documentCount])
}
