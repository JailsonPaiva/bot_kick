'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearToken } from '@/lib/auth'

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/games', label: 'Jogos' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/commands', label: 'Comandos' },
  { href: '/timers', label: 'Timers' },
  { href: '/moderation', label: 'Moderação' },
  { href: '/loyalty', label: 'Pontos' },
  { href: '/alerts', label: 'Alertas' },
  { href: '/giveaways', label: 'Sorteios' },
  { href: '/polls', label: 'Enquetes' },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    clearToken()
    router.push('/login')
  }

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <span className="text-lg font-bold text-white mr-3 shrink-0">Kick Bot</span>
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  pathname === href
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="ml-4 shrink-0 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}
