/**
 * Mini game de demonstração — valida o Game Engine antes do jogo da velha.
 * Comandos: !demo start | join | status | end | help
 */

import { logger } from "../../utils/logger.js";
import type { GameHandlerContext, MiniGame } from "../types.js";

const HELP_TEXT =
  "!demo start — inicia partida (aguarda oponente) | !demo join — entra como oponente | !demo status — status | !demo end — encerra";

function sender(ctx: GameHandlerContext) {
  return {
    kickUserId: ctx.command.message.sender.id,
    username: ctx.command.message.sender.username,
    slug: ctx.command.message.sender.slug,
  };
}

function wrongGameTypeMessage(session: { gameType: string }): string {
  if (session.gameType === "ttt") {
    return "Há uma partida !ttt ativa. Encerre com !ttt forfeit antes de usar !demo.";
  }
  return `Há uma partida !${session.gameType} ativa. Encerre-a antes de usar !demo.`;
}

async function requireDemoSession(
  session: Awaited<ReturnType<GameHandlerContext["gameManager"]["getActiveSession"]>>,
  sendChat: GameHandlerContext["sendChat"],
  broadcasterId: number
) {
  if (!session) return null;
  if (session.gameType !== "demo") {
    await sendChat(broadcasterId, wrongGameTypeMessage(session));
    return null;
  }
  return session;
}

async function handleStart(ctx: GameHandlerContext): Promise<void> {
  const { command, gameManager, sendChat } = ctx;
  const player = sender(ctx);

  const existing = gameManager.getActiveSession(command.channelSlug);
  if (existing) {
    if (existing.gameType !== "demo") {
      await sendChat(
        command.broadcasterId,
        `@${player.username} ${wrongGameTypeMessage(existing)}`
      );
      return;
    }
    await sendChat(
      command.broadcasterId,
      `@${player.username} já existe uma partida demo ativa. Use !demo status ou !demo end.`
    );
    return;
  }

  await gameManager.startGame({
    channelSlug: command.channelSlug,
    broadcasterId: command.broadcasterId,
    gameType: "demo",
    playerX: player,
    initialState: { startedAt: new Date().toISOString() },
  });

  await sendChat(
    command.broadcasterId,
    `@${player.username} iniciou uma partida demo! Outro viewer use !demo join para entrar.`
  );
  logger.info(`[DEMO] Partida iniciada por ${player.username}`);
}

async function handleJoin(ctx: GameHandlerContext): Promise<void> {
  const { command, gameManager, sendChat } = ctx;
  const player = sender(ctx);

  const rawSession = gameManager.getActiveSession(command.channelSlug);
  const sessionCheck = await requireDemoSession(
    rawSession,
    sendChat,
    command.broadcasterId
  );
  if (!rawSession) {
    await sendChat(
      command.broadcasterId,
      `@${player.username} nenhuma partida demo aguardando. Use !demo start.`
    );
    return;
  }
  if (!sessionCheck) return;

  try {
    const session = await gameManager.joinGame({
      channelSlug: command.channelSlug,
      playerO: player,
    });

    await sendChat(
      command.broadcasterId,
      `🎮 Partida demo iniciada! ${session.playerX.username} (X) vs ${session.playerO!.username} (O). Use !demo end para encerrar.`
    );
    logger.info(`[DEMO] ${player.username} entrou na partida ${session.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao entrar na partida.";
    await sendChat(command.broadcasterId, `@${player.username} ${message}`);
  }
}

async function handleStatus(ctx: GameHandlerContext): Promise<void> {
  const { command, gameManager, sendChat } = ctx;
  const rawSession = gameManager.getActiveSession(command.channelSlug);

  if (!rawSession) {
    await sendChat(command.broadcasterId, "Nenhuma partida demo ativa. Use !demo start.");
    return;
  }

  const session = await requireDemoSession(
    rawSession,
    sendChat,
    command.broadcasterId
  );
  if (!session) return;

  if (session.status === "waiting") {
    await sendChat(
      command.broadcasterId,
      `Partida demo aguardando oponente. Host: ${session.playerX.username}. Use !demo join.`
    );
    return;
  }

  await sendChat(
    command.broadcasterId,
    `Partida demo ativa: ${session.playerX.username} vs ${session.playerO?.username ?? "?"}. ID: ${session.id.slice(0, 8)}...`
  );
}

async function handleEnd(ctx: GameHandlerContext): Promise<void> {
  const { command, gameManager, sendChat } = ctx;
  const player = sender(ctx);
  const rawSession = gameManager.getActiveSession(command.channelSlug);

  if (!rawSession) {
    await sendChat(command.broadcasterId, `@${player.username} nenhuma partida demo ativa.`);
    return;
  }

  const session = await requireDemoSession(
    rawSession,
    sendChat,
    command.broadcasterId
  );
  if (!session) return;

  const isParticipant =
    session.playerX.kickUserId === player.kickUserId ||
    session.playerO?.kickUserId === player.kickUserId;

  if (!isParticipant) {
    await sendChat(command.broadcasterId, `@${player.username} apenas participantes podem encerrar a partida.`);
    return;
  }

  await gameManager.endGame({
    channelSlug: command.channelSlug,
    reason: "cancelled",
    announceMessage: `@${player.username} encerrou a partida demo.`,
  });
  logger.info(`[DEMO] Partida encerrada por ${player.username}`);
}

export const demoGame: MiniGame = {
  name: "Demo Game",
  commandPrefix: "demo",
  async handle(ctx: GameHandlerContext): Promise<void> {
    const sub = ctx.parsed.subcommand;

    if (!sub || sub === "help") {
      await ctx.sendChat(ctx.command.broadcasterId, HELP_TEXT);
      return;
    }

    switch (sub) {
      case "start":
        await handleStart(ctx);
        break;
      case "join":
        await handleJoin(ctx);
        break;
      case "status":
        await handleStatus(ctx);
        break;
      case "end":
        await handleEnd(ctx);
        break;
      default:
        await ctx.sendChat(
          ctx.command.broadcasterId,
          `Comando demo desconhecido. ${HELP_TEXT}`
        );
    }
  },
};
