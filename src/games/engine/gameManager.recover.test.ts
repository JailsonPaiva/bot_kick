import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestDatabase } from "../../db/testHelpers.js";
import { GameRepository } from "../../db/repositories/gameRepository.js";
import { PlayerRepository } from "../../db/repositories/playerRepository.js";
import {
  createInitialState,
  serializeTttState,
} from "../ttt/tttGame.js";
import { GameManager } from "./gameManager.js";

function setupGame(
  gameType: string,
  boardState?: string
): {
  manager: GameManager;
  games: GameRepository;
  channelSlug: string;
  gameId: string;
} {
  const db = createTestDatabase();
  const players = new PlayerRepository(db);
  const games = new GameRepository(db);
  const manager = new GameManager(games, players, async () => {});

  const pX = players.findOrCreate({
    kick_user_id: 1,
    username: "alice",
    slug: "alice",
  });
  const pO = players.findOrCreate({
    kick_user_id: 2,
    username: "bob",
    slug: "bob",
  });

  const channelSlug = "test-channel";
  const gameId = `game-${gameType}`;

  games.create({
    id: gameId,
    game_type: gameType,
    channel_slug: channelSlug,
    player_x_id: pX.id,
    player_o_id: pO.id,
    board_state: boardState,
  });

  return { manager, games, channelSlug, gameId };
}

describe("GameManager.recoverActiveGames", () => {
  it("retoma partida ttt com estado válido", () => {
    const state = JSON.stringify(serializeTttState(createInitialState(999)));
    const { manager, channelSlug } = setupGame("ttt", state);

    try {
      manager.recoverActiveGames(999);

      const session = manager.getActiveSession(channelSlug);
      assert.ok(session);
      assert.equal(session!.gameType, "ttt");
      assert.equal(session!.broadcasterId, 999);
    } finally {
      manager.shutdown();
    }
  });

  it("cancela partida demo no restart", () => {
    const { manager, games, channelSlug, gameId } = setupGame("demo");

    try {
      manager.recoverActiveGames();

      assert.equal(manager.getActiveSession(channelSlug), null);
      assert.equal(games.findById(gameId)?.status, "abandoned");
    } finally {
      manager.shutdown();
    }
  });

  it("cancela partida ttt com estado inválido", () => {
    const { manager, games, channelSlug, gameId } = setupGame(
      "ttt",
      '{"invalid":true}'
    );

    try {
      manager.recoverActiveGames();

      assert.equal(manager.getActiveSession(channelSlug), null);
      assert.equal(games.findById(gameId)?.status, "abandoned");
    } finally {
      manager.shutdown();
    }
  });
});
