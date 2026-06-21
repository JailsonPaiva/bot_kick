import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCommand } from "./parser.js";

describe("parseCommand", () => {
  it("reconhece !ttt web como subcomando", () => {
    const parsed = parseCommand("!ttt web");

    assert.ok(parsed);
    assert.equal(parsed.command, "ttt");
    assert.equal(parsed.subcommand, "web");
    assert.deepEqual(parsed.args, []);
  });

  it("reconhece !ttt 5 como jogada numérica", () => {
    const parsed = parseCommand("!ttt 5");

    assert.ok(parsed);
    assert.equal(parsed.command, "ttt");
    assert.equal(parsed.subcommand, null);
    assert.deepEqual(parsed.args, ["5"]);
  });
});
