import SearchPanel from '@/components/SearchPanel'

export default function Page() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl md:text-5xl font-black">Dokumenten-Recherche</h1>
        <p className="text-slate-400 max-w-2xl">
          Frontend nutzt <span className="text-slate-200 font-semibold">Netlify Functions</span> als Serverless API
          und Neon PostgreSQL als Datenbank. Keine Daten enthalten – nur Template.
        </p>
      </header>

      <SearchPanel />
    </div>
  )
}
