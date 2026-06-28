import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kick Bot Dashboard',
  description: 'Painel de controle do bot para Kick.com',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-900 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
