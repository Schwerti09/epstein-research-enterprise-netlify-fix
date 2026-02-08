import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Research Hub Enterprise',
  description: 'Dokumenten-Recherche, semantische Suche, Analysen (Template).',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="font-black tracking-tight">Research Hub</a>
            <div className="text-xs text-slate-400">Neon + Netlify Functions + Microservices</div>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      </body>
    </html>
  )
}
