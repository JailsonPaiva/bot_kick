import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Layout() {
  const navigate = useNavigate()
  const [token] = useState(() => localStorage.getItem('token'))

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold">Kick Bot</span>
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  to="/"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Dashboard
                </Link>
                <Link
                  to="/games"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Jogos
                </Link>
                <Link
                  to="/ranking"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  Ranking
                </Link>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('token')
                navigate('/login')
              }}
              className="text-sm text-gray-300 hover:text-white"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
