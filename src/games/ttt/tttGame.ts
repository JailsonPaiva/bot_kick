/**
 * Lógica pura do jogo da velha — sem dependência de chat ou API.
 */

export type Cell = "X" | "O" | null;
export type TttSymbol = "X" | "O";

export interface TttState {
  broadcasterId: number;
  board: Cell[];
  currentTurn: TttSymbol;
}

const WIN_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createInitialState(broadcasterId: number): TttState {
  return {
    broadcasterId,
    board: Array<Cell>(9).fill(null),
    currentTurn: "X",
  };
}

export function parseTttState(raw: Record<string, unknown>): TttState | null {
  if (!Array.isArray(raw.board) || raw.board.length !== 9) {
    return null;
  }

  const board: Cell[] = raw.board.map((cell) => {
    if (cell === null || cell === "X" || cell === "O") return cell;
    return null;
  });

  const currentTurn: TttSymbol =
    raw.currentTurn === "O" ? "O" : raw.currentTurn === "X" ? "X" : "X";

  const broadcasterId =
    typeof raw.broadcasterId === "number" ? raw.broadcasterId : 0;

  return {
    broadcasterId,
    board,
    currentTurn,
  };
}

export function serializeTttState(state: TttState): Record<string, unknown> {
  return {
    broadcasterId: state.broadcasterId,
    board: state.board,
    currentTurn: state.currentTurn,
  };
}

export type MoveResult =
  | { ok: true; state: TttState; status: "continue" }
  | { ok: true; state: TttState; status: "win"; winner: TttSymbol }
  | { ok: true; state: TttState; status: "draw" }
  | { ok: false; error: string };

export function detectWinner(board: Cell[]): TttSymbol | null {
  for (const [a, b, c] of WIN_LINES) {
    const cell = board[a];
    if (cell !== null && cell === board[b] && cell === board[c]) {
      return cell;
    }
  }
  return null;
}

export function isBoardFull(board: Cell[]): boolean {
  return board.every((cell) => cell !== null);
}

export function playMove(
  state: TttState,
  position: number,
  symbol: TttSymbol
): MoveResult {
  if (position < 1 || position > 9) {
    return { ok: false, error: "Posição inválida. Use !ttt 1-9." };
  }

  if (state.currentTurn !== symbol) {
    return { ok: false, error: "Não é sua vez. Aguarde o oponente." };
  }

  const index = position - 1;
  if (state.board[index] !== null) {
    return { ok: false, error: `Posição ${position} já ocupada.` };
  }

  const board: Cell[] = [...state.board];
  board[index] = symbol;

  const winner = detectWinner(board);
  if (winner) {
    return {
      ok: true,
      state: { ...state, board },
      status: "win",
      winner,
    };
  }

  if (isBoardFull(board)) {
    return {
      ok: true,
      state: { ...state, board },
      status: "draw",
    };
  }

  const nextTurn: TttSymbol = symbol === "X" ? "O" : "X";
  return {
    ok: true,
    state: { ...state, board, currentTurn: nextTurn },
    status: "continue",
  };
}

export function symbolForKickUserId(
  kickUserId: number,
  playerXKickId: number,
  playerOKickId: number | undefined
): TttSymbol | null {
  if (kickUserId === playerXKickId) return "X";
  if (playerOKickId !== undefined && kickUserId === playerOKickId) return "O";
  return null;
}

export function usernameForSymbol(
  symbol: TttSymbol,
  playerXUsername: string,
  playerOUsername: string | undefined
): string {
  return symbol === "X" ? playerXUsername : (playerOUsername ?? "?");
}

export function dbIdForSymbol(
  symbol: TttSymbol,
  playerXDbId: number,
  playerODbId: number | undefined
): number | null {
  if (symbol === "X") return playerXDbId;
  return playerODbId ?? null;
}
