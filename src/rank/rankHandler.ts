/**
 * Handler do comando !rank — top 10, stats pessoais e consulta por usuário.
 */

import { sendMessage } from "../chat/chatSender.js";
import type { PlayerRepository } from "../db/repositories/playerRepository.js";
import { logger } from "../utils/logger.js";
import type { CommandHandler } from "../commands/types.js";
import {
  RANK_HELP,
  renderPlayerNotFound,
  renderPlayerProfile,
  renderTopRanking,
} from "./rankRenderer.js";

const TOP_LIMIT = 10;

export function createRankHandler(
  playerRepository: PlayerRepository
): CommandHandler {
  return async (parsed, ctx) => {
    const { broadcasterId, message } = ctx;
    const senderUsername = message.sender.username;

    if (parsed.subcommand === "me") {
      const player = await playerRepository.findByKickUserId(message.sender.id);

      if (!player) {
        await sendMessage(
          broadcasterId,
          `@${senderUsername} você ainda não jogou. Use !ttt join!`
        );
        return;
      }

      await sendMessage(broadcasterId, renderPlayerProfile(player, true));
      logger.info(`[RANK] Stats pessoais — ${senderUsername}`);
      return;
    }

    if (parsed.args.length > 0) {
      const query = parsed.args[0] ?? "";
      const player = await playerRepository.findByUsernameOrSlug(query);

      if (!player) {
        await sendMessage(broadcasterId, renderPlayerNotFound(query));
        return;
      }

      await sendMessage(broadcasterId, renderPlayerProfile(player));
      logger.info(`[RANK] Consulta — ${query} → ${player.username}`);
      return;
    }

    if (parsed.subcommand && parsed.subcommand !== "me") {
      await sendMessage(
        broadcasterId,
        `Comando rank desconhecido. ${RANK_HELP}`
      );
      return;
    }

    const top = await playerRepository.getTopN(TOP_LIMIT);
    await sendMessage(broadcasterId, renderTopRanking(top, TOP_LIMIT));
    logger.info(`[RANK] Top ${TOP_LIMIT} exibido`);
  };
}
