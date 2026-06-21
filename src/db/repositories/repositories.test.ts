import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestDatabase } from "../testHelpers.js";
import { GameRepository } from "./gameRepository.js";
import { PlayerRepository } from "./playerRepository.js";

describe("PlayerRepository", () => {
  it("findOrCreate cria e reutiliza jogador", () => {
    const db = createTestDatabase();
    const repo = new PlayerRepository(db);

    const first = repo.findOrCreate({
      kick_user_id: 100,
      username: "viewer1",
      slug: "viewer1",
    });
    const second = repo.findOrCreate({
      kick_user_id: 100,
      username: "viewer1",
      slug: "viewer1",
    });

    assert.equal(first.id, second.id);
    assert.equal(first.points, 0);
  });

  it("updateStats aplica pontos de vitória, empate e derrota", () => {
    const db = createTestDatabase();
    const repo = new PlayerRepository(db);
    const player = repo.findOrCreate({
      kick_user_id: 200,
      username: "pro",
      slug: "pro",
    });

    const afterWin = repo.updateStats(player.id, "win");
    assert.equal(afterWin.wins, 1);
    assert.equal(afterWin.points, 3);

    const afterDraw = repo.updateStats(player.id, "draw");
    assert.equal(afterDraw.draws, 1);
    assert.equal(afterDraw.points, 4);

    const afterLoss = repo.updateStats(player.id, "loss");
    assert.equal(afterLoss.losses, 1);
    assert.equal(afterLoss.points, 4);
  });

  it("getTopN ordena por pontos", () => {
    const db = createTestDatabase();
    const repo = new PlayerRepository(db);

    const low = repo.findOrCreate({
      kick_user_id: 1,
      username: "low",
      slug: "low",
    });
    const high = repo.findOrCreate({
      kick_user_id: 2,
      username: "high",
      slug: "high",
    });

    repo.updateStats(low.id, "draw");
    repo.updateStats(high.id, "win");
    repo.updateStats(high.id, "win");

    const top = repo.getTopN(2);
    assert.equal(top[0]?.username, "high");
    assert.equal(top[1]?.username, "low");
  });

  it("findByUsernameOrSlug ignora @ e case", () => {
    const db = createTestDatabase();
    const repo = new PlayerRepository(db);

    repo.findOrCreate({
      kick_user_id: 300,
      username: "KickUser",
      slug: "kick-user",
    });

    assert.equal(repo.findByUsernameOrSlug("@kickuser")?.username, "KickUser");
    assert.equal(repo.findByUsernameOrSlug("kick-user")?.slug, "kick-user");
    assert.equal(repo.findByUsernameOrSlug("missing"), null);
  });
});

describe("GameRepository", () => {
  it("create, finish e abandon atualizam status", () => {
    const db = createTestDatabase();
    const players = new PlayerRepository(db);
    const games = new GameRepository(db);

    const pX = players.findOrCreate({
      kick_user_id: 10,
      username: "x",
      slug: "x",
    });
    const pO = players.findOrCreate({
      kick_user_id: 11,
      username: "o",
      slug: "o",
    });

    const game = games.create({
      id: "game-1",
      game_type: "ttt",
      channel_slug: "canal",
      player_x_id: pX.id,
      player_o_id: pO.id,
      board_state: '{"board":[]}',
    });

    assert.equal(game.status, "active");

    const finished = games.finish(game.id, pX.id, '{"done":true}');
    assert.equal(finished.status, "finished");
    assert.equal(finished.winner_id, pX.id);

    const game2 = games.create({
      id: "game-2",
      game_type: "demo",
      channel_slug: "canal",
      player_x_id: pX.id,
      player_o_id: pO.id,
    });

    const abandoned = games.abandon(game2.id);
    assert.equal(abandoned.status, "abandoned");
  });

  it("findAllActive retorna apenas partidas active", () => {
    const db = createTestDatabase();
    const players = new PlayerRepository(db);
    const games = new GameRepository(db);

    const pX = players.findOrCreate({
      kick_user_id: 20,
      username: "ax",
      slug: "ax",
    });
    const pO = players.findOrCreate({
      kick_user_id: 21,
      username: "ao",
      slug: "ao",
    });

    games.create({
      id: "active-1",
      game_type: "ttt",
      channel_slug: "live",
      player_x_id: pX.id,
      player_o_id: pO.id,
    });
    games.create({
      id: "done-1",
      game_type: "ttt",
      channel_slug: "live",
      player_x_id: pX.id,
      player_o_id: pO.id,
    });
    games.finish("done-1", pX.id, "{}");

    const active = games.findAllActive();
    assert.equal(active.length, 1);
    assert.equal(active[0]?.id, "active-1");
  });
});
