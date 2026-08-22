/**
 * Serviço de timers — envia mensagens agendadas no chat em intervalos configuráveis.
 * Suporta rotação de mensagens (lista circular) para variar o conteúdo.
 */

import { prisma } from "../infra/prisma/client.js";
import { sendMessage } from "../chat/chatSender.js";
import { logger } from "../utils/logger.js";
import { runtimeHealth } from "../ops/runtimeHealth.js";
import { isModuleEnabled } from "../ops/featureFlags.js";

interface ActiveTimer {
  timerId: string;
  handle: ReturnType<typeof setInterval>;
}
interface TimerEntity {
  id: string;
  intervalMinutes: number;
  messages: string[];
  minViewers?: number;
}
interface TimerServiceDeps {
  listActiveTimers: (channelSlug: string) => Promise<TimerEntity[]>;
  send: (broadcasterId: number, content: string) => Promise<void>;
  getViewerCount: (channelSlug: string) => number;
  setIntervalFn: typeof setInterval;
  clearIntervalFn: typeof clearInterval;
}

/** Índice atual de cada timer para rotação de mensagens */
const messageIndexes = new Map<string, number>();

export class TimerService {
  private broadcasterId = 0;
  private channelSlug = "";
  private activeTimers: ActiveTimer[] = [];
  private deps: TimerServiceDeps;

  constructor(deps?: Partial<TimerServiceDeps>) {
    this.deps = {
      listActiveTimers: async (channelSlug) =>
        prisma.timer.findMany({ where: { channelSlug, isActive: true } }),
      send: sendMessage,
      getViewerCount: (channelSlug) => runtimeHealth.getViewerCount(channelSlug),
      setIntervalFn: setInterval,
      clearIntervalFn: clearInterval,
      ...deps,
    };
  }

  async start(broadcasterId: number, channelSlug: string): Promise<void> {
    this.broadcasterId = broadcasterId;
    this.channelSlug = channelSlug;

    const timers = await this.deps.listActiveTimers(channelSlug);

    for (const timer of timers) {
      this.scheduleTimer(
        timer.id,
        timer.intervalMinutes,
        timer.messages,
        timer.minViewers ?? 0
      );
    }

    logger.info("Timers iniciados", {
      module: "timers",
      channelSlug,
      count: timers.length,
    });
  }

  async reload(): Promise<void> {
    this.stop();
    if (this.broadcasterId > 0) {
      await this.start(this.broadcasterId, this.channelSlug);
    }
  }

  stop(): void {
    for (const { handle } of this.activeTimers) {
      this.deps.clearIntervalFn(handle);
    }
    this.activeTimers = [];
    logger.info("Timers encerrados", { module: "timers" });
  }

  private scheduleTimer(
    timerId: string,
    intervalMinutes: number,
    messages: string[],
    minViewers = 0
  ): void {
    if (messages.length === 0) return;

    const intervalMs = intervalMinutes * 60 * 1000;

    const handle = this.deps.setIntervalFn(() => {
      void this.fireTimer(timerId, messages, minViewers);
    }, intervalMs);

    this.activeTimers.push({ timerId, handle });
    logger.debug("Timer agendado", {
      module: "timers",
      timerId,
      intervalMinutes,
      minViewers,
    });
  }

  private async fireTimer(
    timerId: string,
    messages: string[],
    minViewers = 0
  ): Promise<void> {
    if (messages.length === 0) return;
    if (!isModuleEnabled(this.channelSlug, "timers")) return;

    if (minViewers > 0) {
      const viewers = this.deps.getViewerCount(this.channelSlug);
      if (viewers < minViewers) {
        logger.debug("Timer ignorado por minViewers", {
          module: "timers",
          channelSlug: this.channelSlug,
          timerId,
          viewers,
          minViewers,
        });
        return;
      }
    }

    const currentIndex = messageIndexes.get(timerId) ?? 0;
    const message = messages[currentIndex % messages.length];
    const nextIndex = (currentIndex + 1) % messages.length;

    messageIndexes.set(timerId, nextIndex);

    try {
      await this.deps.send(this.broadcasterId, message ?? "");
      logger.debug("Timer disparado", { module: "timers", timerId });
    } catch (err) {
      logger.error("Erro ao disparar timer", { module: "timers", timerId }, err);
    }
  }
}

export const timerService = new TimerService();
