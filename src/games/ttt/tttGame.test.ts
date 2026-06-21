import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialState,
  detectWinner,
  isBoardFull,
  playMove,
  serializeTttState,
  parseTttState,
} from "./tttGame.js";

describe("tttGame", () => {
  it("createInitialState inicia com tabuleiro vazio e vez do X", () => {
    const state = createInitialState(99);
    assert.equal(state.currentTurn, "X");
    assert.equal(state.broadcasterId, 99);
    assert.deepEqual(state.board, Array(9).fill(null));
  });

  it("playMove alterna turnos em jogada válida", () => {
    const state = createInitialState(1);
    const move = playMove(state, 5, "X");

    assert.equal(move.ok, true);
    if (!move.ok || move.status !== "continue") {
      assert.fail("Esperava jogada contínua");
    }

    assert.equal(move.state.board[4], "X");
    assert.equal(move.state.currentTurn, "O");
  });

  it("playMove rejeita posição inválida", () => {
    const state = createInitialState(1);
    const low = playMove(state, 0, "X");
    const high = playMove(state, 10, "X");

    assert.equal(low.ok, false);
    assert.equal(high.ok, false);
    if (low.ok || high.ok) assert.fail();
    assert.match(low.error, /Posição inválida/);
  });

  it("playMove rejeita posição ocupada", () => {
    let state = createInitialState(1);
    const first = playMove(state, 5, "X");
    assert.equal(first.ok, true);
    if (!first.ok) assert.fail();

    state = first.state;
    const second = playMove(state, 5, "O");

    assert.equal(second.ok, false);
    if (second.ok) assert.fail();
    assert.match(second.error, /Posição 5 já ocupada/);
  });

  it("playMove rejeita jogada fora de turno", () => {
    const state = createInitialState(1);
    const move = playMove(state, 5, "O");

    assert.equal(move.ok, false);
    if (move.ok) assert.fail();
    assert.match(move.error, /Não é sua vez/);
  });

  it("detectWinner identifica vitória na linha superior", () => {
    const board = ["X", "X", "X", null, "O", null, null, null, "O"] as const;
    assert.equal(detectWinner([...board]), "X");
  });

  it("playMove detecta vitória", () => {
    let state = createInitialState(1);
    const moves: Array<[number, "X" | "O"]> = [
      [1, "X"],
      [4, "O"],
      [2, "X"],
      [5, "O"],
      [3, "X"],
    ];

    for (const [pos, symbol] of moves) {
      const result = playMove(state, pos, symbol);
      assert.equal(result.ok, true);
      if (!result.ok) assert.fail();

      if (result.status === "win") {
        assert.equal(result.winner, "X");
        return;
      }

      state = result.state;
    }

    assert.fail("Vitória não detectada");
  });

  it("playMove detecta empate", () => {
    const result = playMove(
      {
        broadcasterId: 1,
        board: ["X", "O", "X", "X", "O", "O", "O", "X", null],
        currentTurn: "X",
      },
      9,
      "X"
    );

    assert.equal(result.ok, true);
    if (!result.ok) assert.fail(result.error);

    assert.equal(result.status, "draw");
    assert.equal(isBoardFull(result.state.board), true);
  });

  it("serializeTttState e parseTttState são reversíveis", () => {
    const original = createInitialState(42);
    original.board[0] = "X";
    original.currentTurn = "O";

    const parsed = parseTttState(serializeTttState(original));
    assert.ok(parsed);
    assert.deepEqual(parsed!.board, original.board);
    assert.equal(parsed!.currentTurn, "O");
    assert.equal(parsed!.broadcasterId, 42);
  });
});
