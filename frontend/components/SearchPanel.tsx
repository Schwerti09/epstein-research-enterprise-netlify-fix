'use client'

import { useEffect, useMemo, useState } from 'react'

type DocRow = {
  id: string
  document_id: string
  title: string
  document_type: string | null
  release_date: string | null
  source_url: string | null
  ai_summary?: string
  total_count?: number
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || '/api'
}

export default function SearchPanel() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<DocRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => rows?.[0]?.total_count || 0, [rows])
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const url = new URL(`${apiBase()}/documents`, window.location.origin)
      url.searchParams.set('q', q)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', String(limit))
      const res = await fetch(url.toString(), { headers: { 'x-api-key': '' } })
      const data = await res.json()
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Request failed')
      setRows(data.data || [])
    } catch (e: any) {
      setError(e?.message || 'Fehler')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // initial

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1">
          <label className="text-sm text-slate-300">Suche</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Titel, Inhalt, Entitäten…"
            className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-800 px-4 py-3 outline-none focus:border-cyan-500"
          />
        </div>
        <button
          onClick={() => { setPage(1); load() }}
          disabled={loading}
          className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black px-5 py-3 disabled:opacity-60"
        >
          {loading ? 'Lade…' : 'Suchen'}
        </button>
      </div>

      <div className="mt-4 text-sm text-slate-400">
        API: <code className="text-slate-200">{apiBase()}/documents</code>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-200">
          {error}
          <div className="text-xs text-red-300/80 mt-2">
            Tipp: In Netlify/Env muss <code>NEON_DATABASE_URL</code> (oder <code>DATABASE_URL</code>) gesetzt sein.
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {rows.length === 0 && !loading ? (
          <div className="text-slate-500 text-sm">Keine Daten. (Template) — Seed optional über API Service.</div>
        ) : null}

        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
              <div>
                <div className="text-lg font-bold">{r.title}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {r.document_type || 'unknown'} • {r.release_date || 'n/a'} • {r.document_id}
                </div>
              </div>
              {r.source_url ? (
                <a href={r.source_url} className="text-sm text-cyan-300 hover:underline" target="_blank" rel="noreferrer">
                  Quelle
                </a>
              ) : null}
            </div>

            {r.ai_summary ? (
              <p className="text-sm text-slate-300 mt-3">{r.ai_summary}</p>
            ) : (
              <p className="text-sm text-slate-500 mt-3">Keine AI-Zusammenfassung vorhanden.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => { setPage((p) => Math.max(1, p - 1)); setTimeout(load, 0) }}
          disabled={loading || page <= 1}
          className="text-sm px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 disabled:opacity-50"
        >
          ← Zurück
        </button>
        <div className="text-xs text-slate-400">
          Seite {page} / {totalPages} • Total {total}
        </div>
        <button
          onClick={() => { setPage((p) => p + 1); setTimeout(load, 0) }}
          disabled={loading || page >= totalPages}
          className="text-sm px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 disabled:opacity-50"
        >
          Weiter →
        </button>
      </div>
    </section>
  )
}
