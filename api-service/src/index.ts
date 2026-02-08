import Fastify from 'fastify'
import cors from '@fastify/cors'
import { documentsRoutes } from './routes/v2/documents.js'

const app = Fastify({ logger: true })
await app.register(cors, { origin: true })

app.get('/health', async () => ({ ok: true }))
await app.register(documentsRoutes)

const port = Number(process.env.PORT || 3001)
await app.listen({ port, host: '0.0.0.0' })
