'use client'

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import type { PlayGameView } from '@/types/play'
import { Button } from '@/components/ui/Button'

interface GameResultModalProps {
  game: PlayGameView
  open: boolean
  onClose: () => void
}

export function GameResultModal({ game, open, onClose }: GameResultModalProps) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      firedRef.current = false
      return
    }
    if (firedRef.current) return
    firedRef.current = true

    if (game.finishedReason === 'win') {
      void fireWinConfetti()
    } else if (game.finishedReason === 'draw') {
      void fireDrawConfetti()
    }
  }, [open, game.finishedReason])

  if (!open) return null

  const { title, subtitle, emoji } = getResultContent(game)
  const isYouWinner = game.winner && game.yourSymbol && game.winner === game.yourSymbol

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-result-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-gray-600 bg-gray-800 p-8 text-center shadow-2xl animate-scale-in">
        <div className="text-6xl mb-4">{emoji}</div>
        <h2 id="game-result-title" className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-gray-300 mb-6">{subtitle}</p>

        {isYouWinner && (
          <p className="text-green-400 text-sm font-medium mb-4">Parabéns, você venceu!</p>
        )}
        {game.finishedReason === 'win' && game.winner && !isYouWinner && (
          <p className="text-gray-400 text-sm mb-4">
            Boa partida! Tente novamente com <code>!ttt join</code>
          </p>
        )}

        <Button className="w-full" onClick={onClose}>Finalizar</Button>
      </div>
    </div>
  )
}

function getResultContent(game: PlayGameView) {
  if (game.finishedReason === 'draw') {
    return {
      emoji: '🤝',
      title: 'Empate!',
      subtitle: `${game.playerX.username} e ${game.playerO?.username ?? 'oponente'} empataram.`,
    }
  }
  if (game.finishedReason === 'forfeit') {
    return {
      emoji: '🏳️',
      title: `${game.winnerUsername} venceu!`,
      subtitle: 'Vitória por desistência do oponente.',
    }
  }
  return {
    emoji: '🏆',
    title: `${game.winnerUsername} venceu!`,
    subtitle: `Vitória do jogador ${game.winner ?? '?'}.`,
  }
}

async function fireWinConfetti(): Promise<void> {
  const duration = 2500
  const end = Date.now() + duration
  const frame = (): void => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.65 }, colors: ['#60a5fa', '#c084fc', '#fbbf24', '#34d399'] })
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, colors: ['#60a5fa', '#c084fc', '#fbbf24', '#34d399'] })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  confetti({ particleCount: 80, spread: 100, origin: { y: 0.6 }, colors: ['#60a5fa', '#c084fc', '#fbbf24', '#34d399'] })
  frame()
}

async function fireDrawConfetti(): Promise<void> {
  confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 }, colors: ['#9ca3af', '#d1d5db', '#fbbf24'] })
}
