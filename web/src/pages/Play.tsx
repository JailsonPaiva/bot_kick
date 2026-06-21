import { useSearchParams } from 'react-router-dom'
import { usePlaySession } from '../hooks/usePlaySession'
import TicTacToeBoard from '../components/TicTacToeBoard'
import PlayerInfo from '../components/PlayerInfo'
import GameResultModal from '../components/GameResultModal'

export default function Play() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const {
    game,
    loading,
    error,
    moving,
    showResultModal,
    makeMove,
    dismissResult,
    reload,
  } = usePlaySession(token)

  if (loading) {
    return (
      <PageShell>
        <p className="text-center text-gray-400">Carregando partida...</p>
      </PageShell>
    )
  }

  if (error && !game) {
    return (
      <PageShell>
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => void reload()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
          >
            Tentar novamente
          </button>
        </div>
      </PageShell>
    )
  }

  if (!game) {
    return (
      <PageShell>
        <p className="text-center text-gray-400">Partida não disponível.</p>
      </PageShell>
    )
  }

  const isFinished = game.status === 'finished'
  const statusMessage = getStatusMessage(game)

  return (
    <PageShell>
      <div className="max-w-lg mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Jogo da Velha</h1>
          <p className="text-gray-400 text-sm">
            Canal: {game.channelSlug} · Modo híbrido (chat + web)
          </p>
        </header>

        <PlayerInfo game={game} />

        {game.status === 'waiting' ? (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-center mb-6">
            <p className="text-yellow-200">
              Aguardando oponente entrar com{' '}
              <code className="text-yellow-100">!ttt join</code>
            </p>
          </div>
        ) : (
          <>
            <TicTacToeBoard
              board={game.board}
              yourSymbol={game.yourSymbol}
              isYourTurn={game.isYourTurn}
              disabled={moving || isFinished}
              onMove={(position) => void makeMove(position)}
            />

            <p className="text-center mt-6 text-sm text-gray-300">{statusMessage}</p>
          </>
        )}

        {error && (
          <p className="text-center mt-4 text-sm text-red-400">{error}</p>
        )}

        <footer className="mt-10 text-center text-xs text-gray-500">
          <p>Use !ttt web no chat para renovar o link (válido por 10 min).</p>
          <p className="mt-1">Jogadas no chat também atualizam esta tela em tempo real.</p>
        </footer>
      </div>

      <GameResultModal
        game={game}
        open={showResultModal && isFinished}
        onClose={dismissResult}
      />
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-10 px-4">
      {children}
    </div>
  )
}

function getStatusMessage(
  game: NonNullable<ReturnType<typeof usePlaySession>['game']>
): string {
  if (game.status === 'finished') {
    if (game.finishedReason === 'draw') return 'Partida encerrada em empate.'
    if (game.winnerUsername) return `${game.winnerUsername} venceu a partida!`
    return 'Partida encerrada.'
  }

  if (game.isYourTurn) {
    return 'Sua vez! Clique em uma posição livre.'
  }

  if (game.status === 'active') {
    return 'Aguardando jogada do oponente...'
  }

  return 'Aguardando início da partida...'
}
