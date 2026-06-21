import type { Cell } from '../types/play'

interface TicTacToeBoardProps {
  board: Cell[]
  yourSymbol: 'X' | 'O' | null
  isYourTurn: boolean
  disabled?: boolean
  onMove: (position: number) => void
}

export default function TicTacToeBoard({
  board,
  yourSymbol,
  isYourTurn,
  disabled = false,
  onMove,
}: TicTacToeBoardProps) {
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-sm mx-auto">
      {board.map((cell, index) => {
        const position = index + 1
        const canPlay =
          !disabled &&
          isYourTurn &&
          cell === null &&
          yourSymbol !== null

        return (
          <button
            key={position}
            type="button"
            disabled={!canPlay}
            onClick={() => onMove(position)}
            className={`
              aspect-square rounded-xl text-4xl font-bold border-2 transition-all
              ${cell === 'X' ? 'text-blue-400 border-blue-500 bg-blue-950/40' : ''}
              ${cell === 'O' ? 'text-purple-400 border-purple-500 bg-purple-950/40' : ''}
              ${cell === null ? 'border-gray-600 bg-gray-800' : ''}
              ${canPlay ? 'hover:border-green-400 hover:bg-green-950/30 cursor-pointer' : 'cursor-default'}
              ${!canPlay && cell === null ? 'opacity-60' : ''}
            `}
            aria-label={`Posição ${position}${cell ? `, ${cell}` : ', vazia'}`}
          >
            {cell ?? position}
          </button>
        )
      })}
    </div>
  )
}
