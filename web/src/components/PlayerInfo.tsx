import type { PlayGameView } from '../types/play'

interface PlayerInfoProps {
  game: PlayGameView
}

export default function PlayerInfo({ game }: PlayerInfoProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
      <PlayerCard
        username={game.playerX.username}
        symbol="X"
        highlight={game.yourSymbol === 'X'}
        isTurn={game.currentTurn === 'X' && game.status === 'active'}
      />
      <PlayerCard
        username={game.playerO?.username ?? 'Aguardando...'}
        symbol="O"
        highlight={game.yourSymbol === 'O'}
        isTurn={game.currentTurn === 'O' && game.status === 'active'}
        waiting={!game.playerO}
      />
    </div>
  )
}

function PlayerCard({
  username,
  symbol,
  highlight,
  isTurn,
  waiting = false,
}: {
  username: string
  symbol: 'X' | 'O'
  highlight: boolean
  isTurn: boolean
  waiting?: boolean
}) {
  const symbolColor = symbol === 'X' ? 'text-blue-400' : 'text-purple-400'

  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? 'border-green-500 bg-green-950/20' : 'border-gray-700 bg-gray-800'
      } ${isTurn ? 'ring-2 ring-yellow-500/60' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Jogador {symbol}</p>
          <p className="text-lg font-semibold">{username}</p>
        </div>
        <span className={`text-3xl font-bold ${symbolColor}`}>{symbol}</span>
      </div>
      {waiting && (
        <p className="text-xs text-gray-500 mt-2">Aguardando oponente no chat...</p>
      )}
      {isTurn && !waiting && (
        <p className="text-xs text-yellow-400 mt-2">Vez deste jogador</p>
      )}
      {highlight && (
        <p className="text-xs text-green-400 mt-1">Você</p>
      )}
    </div>
  )
}
