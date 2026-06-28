import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TimerService } from "./timerService.js";

describe("TimerService", () => {
  it("rotaciona mensagens do timer em ordem circular", async () => {
    const callbacks: Array<() => void> = [];
    const sent: string[] = [];

    const service = new TimerService({
      listActiveTimers: async () => [
        { id: "t1", intervalMinutes: 1, messages: ["A", "B"] },
      ],
      send: async (_broadcasterId, content) => {
        sent.push(content);
      },
      setIntervalFn: ((cb: () => void) => {
        callbacks.push(cb);
        return { id: callbacks.length } as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: (() => {}) as typeof clearInterval,
    });

    await service.start(99, "canal");
    assert.equal(callbacks.length, 1);

    callbacks[0]?.();
    await Promise.resolve();
    callbacks[0]?.();
    await Promise.resolve();
    callbacks[0]?.();
    await Promise.resolve();

    assert.deepEqual(sent, ["A", "B", "A"]);
    service.stop();
  });

  it("reload encerra timers antigos e agenda novamente", async () => {
    const callbacks: Array<() => void> = [];
    const cleared: unknown[] = [];

    const service = new TimerService({
      listActiveTimers: async () => [
        { id: "t1", intervalMinutes: 1, messages: ["A"] },
      ],
      send: async () => {},
      setIntervalFn: ((cb: () => void) => {
        callbacks.push(cb);
        return { id: callbacks.length } as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: ((handle: unknown) => {
        cleared.push(handle);
      }) as typeof clearInterval,
    });

    await service.start(99, "canal");
    assert.equal(callbacks.length, 1);

    await service.reload();
    assert.equal(cleared.length, 1);
    assert.equal(callbacks.length, 2);

    service.stop();
  });
});
