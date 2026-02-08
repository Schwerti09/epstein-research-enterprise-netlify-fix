# epstein-research-enterprise (Microservices V3.0)

Monorepo: **Next.js Frontend (Netlify)** + **Netlify Functions (Neon PostgreSQL)** + **API Service (Fastify)** + **AI Worker (FastAPI)**.

> Hinweis: Das Repo ist ein technisches Template für Dokumenten-/Archiv-Recherche mit semantischer Suche.
> Keine Inhalte/Daten sind enthalten. Bitte beachte Datenschutz und Rechte an Quellenmaterial.

## Quickstart (lokal)

```bash
cp .env.example .env
# .env anpassen (NEON_DATABASE_URL / DATABASE_URL etc.)

docker compose up -d --build
```

- Frontend: http://localhost:8888 (Netlify Dev)
- API Service: http://localhost:3001/health
- AI Worker: http://localhost:8000/docs

## Deploy

### Frontend + Netlify Functions (Netlify)
1. Repo auf GitHub pushen
2. Netlify: neues Site-Projekt
3. Build settings:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `.next` (Netlify Next Runtime)
4. Env Vars in Netlify:
   - `NEON_DATABASE_URL` (oder `DATABASE_URL`)
   - `OPENAI_API_KEY` (optional für semantische Suche)
   - `NEXT_PUBLIC_API_BASE=/api`

### API Service
Separat deployen (Fly.io/Render/VM). Env:
- `DATABASE_URL` (Neon)
- `PORT=3001`

### AI Worker
Separat deployen (Container/VM). Env:
- `NEON_DATABASE_URL` (Neon)
- `OPENAI_API_KEY`
- `PORT=8000`

## Datenbank (Neon)
Schema: `database/migrations/001_initial_schema.sql`

```bash
psql "$NEON_DATABASE_URL" -f database/migrations/001_initial_schema.sql
```
