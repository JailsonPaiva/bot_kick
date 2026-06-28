/**
 * Handlers de comandos de loyalty:
 * - !pontos
 * - !top
 * - !dar @usuario quantidade
 */

import { sendMessage } from "../chat/chatSender.js";
import { logger } from "../utils/logger.js";
import type { CommandHandler } from "../commands/types.js";
import type { LoyaltyService } from "./loyaltyService.js";

export function createPointsHandler(service: LoyaltyService): CommandHandler {
  return async (_parsed, ctx) => {
    const balance = await service.getBalance(
      ctx.channelSlug,
      ctx.message.sender.id
    );
    await sendMessage(
      ctx.broadcasterId,
      `@${ctx.message.sender.username} você tem ${balance} ponto(s).`
    );
  };
}

export function createTopHandler(service: LoyaltyService): CommandHandler {
  return async (_parsed, ctx) => {
    const top = await service.getTop(ctx.channelSlug, 5);
    if (top.length === 0) {
      await sendMessage(
        ctx.broadcasterId,
        "📊 Ranking de pontos vazio. Converse no chat para acumular pontos!"
      );
      return;
    }

    const line = top
      .map((p, i) => `${i + 1}. ${p.username} (${p.balance})`)
      .join(" | ");
    await sendMessage(ctx.broadcasterId, `🏆 Top pontos: ${line}`);
  };
}

export function createTransferHandler(service: LoyaltyService): CommandHandler {
  return async (parsed, ctx) => {
    const target = parsed.args[0] ?? "";
    const amountRaw = parsed.args[1] ?? "";
    const amount = Number.parseInt(amountRaw, 10);

    if (!target || !amountRaw) {
      await sendMessage(
        ctx.broadcasterId,
        `@${ctx.message.sender.username} uso: !dar @usuario quantidade`
      );
      return;
    }

    const result = await service.transferPoints(
      ctx.channelSlug,
      {
        kickUserId: ctx.message.sender.id,
        username: ctx.message.sender.username,
        slug: ctx.message.sender.slug,
      },
      target,
      amount
    );

    if (!result.ok) {
      await sendMessage(
        ctx.broadcasterId,
        `@${ctx.message.sender.username} ${result.error}`
      );
      return;
    }

    await sendMessage(
      ctx.broadcasterId,
      `@${ctx.message.sender.username} transferiu ${amount} ponto(s) para @${result.toUsername}. Saldo atual: ${result.fromBalance}.`
    );
    logger.info(
      `[LOYALTY] Transferência: ${ctx.message.sender.username} -> ${result.toUsername} (${amount})`
    );
  };
}
