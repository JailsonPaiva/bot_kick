'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { setToken } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { password })
      if (response.data.success) {
        setToken(response.data.data.token as string)
        router.push('/')
      }
    } catch {
      setError('Senha incorreta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-xl border border-gray-700">
        <div className="text-center">
          <div className="text-4xl mb-3">🎮</div>
          <h1 className="text-3xl font-bold text-white">Kick Bot Dashboard</h1>
          <p className="mt-2 text-sm text-gray-400">Entre com a senha do administrador</p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <Input
            type="password"
            label="Senha"
            placeholder="Digite a senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-700 rounded-md py-2 px-3">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
