import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampEntryDurationSeconds,
  canEnter,
  describeEntryInstructions,
  isEntryWindowOpen,
  normalizeEntryCommand,
  normalizeEntryMode,
  pickWeightedEntry,
  resolveEntryWeight,
  totalEntryTickets,
} from "./giveawayService.js";

describe("giveawayService weighting", () => {
  it("resolveEntryWeight dá 2 para assinante quando weightedSubs=true", () => {
    assert.equal(
      resolveEntryWeight(true, [{ type: "subscriber", text: "Sub" }]),
      2
    );
    assert.equal(resolveEntryWeight(true, []), 1);
    assert.equal(
      resolveEntryWeight(false, [{ type: "subscriber", text: "Sub" }]),
      1
    );
  });

  it("totalEntryTickets soma pesos", () => {
    assert.equal(
      totalEntryTickets([
        { weight: 1 },
        { weight: 2 },
        { weight: 1 },
      ]),
      4
    );
  });

  it("pickWeightedEntry retorna null para lista vazia", () => {
    assert.equal(pickWeightedEntry([]), null);
  });

  it("pickWeightedEntry respeita peso maior com alta probabilidade", () => {
    const entries = [
      { id: "a", weight: 1 },
      { id: "b", weight: 99 },
    ];
    let bWins = 0;
    for (let i = 0; i < 200; i++) {
      const pick = pickWeightedEntry(entries);
      if (pick?.id === "b") bWins++;
    }
    assert.ok(bWins > 150, `esperado B ganhar maioria, ganhou ${bWins}/200`);
  });
});

describe("giveawayService entry mode", () => {
  it("normalizeEntryMode aceita command e chat", () => {
    assert.equal(normalizeEntryMode("command"), "command");
    assert.equal(normalizeEntryMode("chat"), "chat");
    assert.equal(normalizeEntryMode("outro"), "command");
    assert.equal(normalizeEntryMode(undefined), "command");
  });

  it("normalizeEntryCommand remove ! e caracteres inválidos", () => {
    assert.equal(normalizeEntryCommand("!Entrar"), "entrar");
    assert.equal(normalizeEntryCommand("join-now"), "join-now");
    assert.equal(normalizeEntryCommand("!!!"), "entrar");
    assert.equal(normalizeEntryCommand(""), "entrar");
  });

  it("clampEntryDurationSeconds limita entre 15 e 3600", () => {
    assert.equal(clampEntryDurationSeconds(10), 15);
    assert.equal(clampEntryDurationSeconds(60), 60);
    assert.equal(clampEntryDurationSeconds(99999), 3600);
    assert.equal(clampEntryDurationSeconds("abc"), 60);
  });

  it("isEntryWindowOpen só restringe modo chat", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 1_000);
    assert.equal(
      isEntryWindowOpen({ entryMode: "command", entryEndsAt: past }),
      true
    );
    assert.equal(
      isEntryWindowOpen({ entryMode: "chat", entryEndsAt: future }),
      true
    );
    assert.equal(
      isEntryWindowOpen({ entryMode: "chat", entryEndsAt: past }),
      false
    );
    assert.equal(
      isEntryWindowOpen({ entryMode: "chat", entryEndsAt: null }),
      false
    );
  });

  it("describeEntryInstructions diferencia comando e chat", () => {
    const cmd = describeEntryInstructions({
      entryMode: "command",
      entryCommand: "join",
      entryEndsAt: null,
      costPoints: 0,
      weightedSubs: false,
    });
    assert.match(cmd, /!join/);

    const chat = describeEntryInstructions({
      entryMode: "chat",
      entryCommand: "entrar",
      entryEndsAt: new Date("2030-01-01T12:00:00Z"),
      costPoints: 5,
      weightedSubs: true,
    });
    assert.match(chat, /Digite qualquer mensagem/i);
    assert.match(chat, /5 ponto/);
    assert.match(chat, /2x/);
  });
});

describe("giveawayService canEnter", () => {
  it("followers exige badge ou follower conhecido", () => {
    assert.equal(canEnter("followers", []), false);
    assert.equal(canEnter("followers", [{ type: "follower", text: "F" }]), true);
    assert.equal(canEnter("followers", [], true), true);
  });

  it("both aceita sub ou follower", () => {
    assert.equal(canEnter("both", []), false);
    assert.equal(canEnter("both", [{ type: "subscriber", text: "S" }]), true);
    assert.equal(canEnter("both", [{ type: "follower", text: "F" }]), true);
  });

  it("everyone sempre entra", () => {
    assert.equal(canEnter("everyone", []), true);
  });
});
