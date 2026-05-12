import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Football Analyzer — Análisis Estadístico',
  description: 'Análisis estadístico avanzado de partidos de fútbol',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#0a0f1a] text-slate-100 antialiased">
        <header className="border-b border-slate-800 bg-[#0d1424] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
            <span className="text-2xl">⚽</span>
            <span className="font-bold text-lg tracking-tight text-white">
              Football <span className="text-green-400">Analyzer</span>
            </span>
            <span className="ml-auto text-xs text-slate-500">
              5 Grandes Ligas · Análisis Estadístico
            </span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
