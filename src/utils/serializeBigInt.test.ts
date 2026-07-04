import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertJsonSerializable, serializeBigInts } from "./serializeBigInt.js";

describe("serializeBigInts", () => {
  it("converte BigInt em string", () => {
    assert.equal(serializeBigInts(123n), "123");
  });

  it("converte BigInt aninhado em objetos e arrays", () => {
    const input = {
      users: [{ kickUserId: 999n, name: "a" }],
      meta: { count: 1n },
    };

    const output = serializeBigInts(input);
    assert.equal(output.users[0]?.kickUserId, "999");
    assert.equal(output.meta.count, "1");
  });

  it("preserva Date, number e string", () => {
    const date = new Date("2025-01-01T00:00:00.000Z");
    const output = serializeBigInts({ date, value: 10, label: "ok" });
    assert.equal(output.date, date);
    assert.equal(output.value, 10);
    assert.equal(output.label, "ok");
  });

  it("assertJsonSerializable não lança para payload com BigInt", () => {
    assert.doesNotThrow(() =>
      assertJsonSerializable({ kickUserId: 42n, balance: 100 })
    );
  });
});
