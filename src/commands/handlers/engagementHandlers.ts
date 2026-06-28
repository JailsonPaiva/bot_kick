/**
 * Handlers de comandos da Fase 4:
 * - Sorteios: !sorteio, !entrar, !reroll
 * - Enquetes: !poll, !votar
 */

import { sendMessage } from "../../chat/chatSender.js";
import type { CommandHandler } from "../types.js";
import { giveawayService } from "../../engagement/giveawayService.js";
import { pollService } from "../../engagement/pollService.js";
import { broadcastAlert } from "../../api/alertEvents.js";

function isBroadcasterOrMod(badges: Array<{ type: string; text: string }>): boolean {
  return badges.some((b) => {
    const t = b.type.toLowerCase();
    return t === "broadcaster" || t === "moderator";
  });
}

export const handleGiveaway: CommandHandler = async (parsed, ctx) => {
  const isStaff = isBroadcasterOrMod(ctx.message.sender.identity.badges);
  const sub = parsed.subcommand;

  if (sub === "status") {
    const open = await giveawayService.getOpen(ctx.channelSlug);
    if (!open) {
      await sendMessage(ctx.broadcasterId, "Nenhum sorteio aberto no momento.");
      return;
    }
    await sendMessage(
      ctx.broadcasterId,
      `🎁 Sorteio aberto: ${open.prize} | Entradas: ${open.entries.length} | Custo: ${open.costPoints} ponto(s). Use !entrar`
    );
    return;
  }

  if (sub === "end") {
    if (!isStaff) {
      await sendMessage(ctx.broadcasterId, "Apenas moderação pode encerrar sorteio.");
      return;
    }
    const result = await giveawayService.draw(ctx.channelSlug);
    if (!result.ok) {
      await sendMessage(ctx.broadcasterId, result.error);
      return;
    }
    if (!result.winner) {
      await sendMessage(
        ctx.broadcasterId,
        `🎁 Sorteio encerrado sem participantes. Prêmio: ${result.prize}`
      );
      return;
    }

    await sendMessage(
      ctx.broadcasterId,
      `🎉 Vencedor do sorteio (${result.prize}): @${result.winner.username} entre ${result.entries} entrada(s)!`
    );
    broadcastAlert({
      type: "giveaway_winner",
      channelSlug: ctx.channelSlug,
      title: "Sorteio encerrado",
      message: `@${result.winner.username} venceu: ${result.prize}`,
      metadata: { entries: result.entries, giveawayId: result.giveawayId },
    });
    return;
  }

  if (!isStaff) {
    await sendMessage(
      ctx.broadcasterId,
      `@${ctx.message.sender.username} uso permitido: !sorteio status`
    );
    return;
  }

  const raw = parsed.rawArgs.trim();
  if (!raw) {
    await sendMessage(
      ctx.broadcasterId,
      "Uso: !sorteio <prêmio> [custo-em-pontos] | !sorteio status | !sorteio end"
    );
    return;
  }

  const parts = raw.split(/\s+/);
  const maybeCost = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  const hasCost = Number.isFinite(maybeCost);
  const costPoints = hasCost ? Math.max(0, maybeCost) : 0;
  const prize = hasCost ? parts.slice(0, -1).join(" ").trim() : raw;

  if (!prize) {
    await sendMessage(ctx.broadcasterId, "Prêmio inválido para sorteio.");
    return;
  }

  try {
    const giveaway = await giveawayService.create(
      ctx.channelSlug,
      prize,
      "everyone",
      costPoints
    );
    await sendMessage(
      ctx.broadcasterId,
      `🎁 Sorteio iniciado! Prêmio: ${giveaway.prize}. Para participar use !entrar${
        giveaway.costPoints > 0 ? ` (custo ${giveaway.costPoints} ponto(s))` : ""
      }`
    );
    broadcastAlert({
      type: "giveaway_open",
      channelSlug: ctx.channelSlug,
      title: "Novo sorteio aberto",
      message: `Prêmio: ${giveaway.prize}`,
      metadata: { giveawayId: giveaway.id, costPoints: giveaway.costPoints },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sendMessage(ctx.broadcasterId, message);
  }
};

export const handleGiveawayEntry: CommandHandler = async (_parsed, ctx) => {
  const result = await giveawayService.enterOpen(ctx.channelSlug, {
    kickUserId: ctx.message.sender.id,
    username: ctx.message.sender.username,
    slug: ctx.message.sender.slug,
    badges: ctx.message.sender.identity.badges,
  });

  if (!result.ok) {
    await sendMessage(ctx.broadcasterId, `@${ctx.message.sender.username} ${result.error}`);
    return;
  }

  await sendMessage(
    ctx.broadcasterId,
    `@${ctx.message.sender.username} entrada confirmada! Total atual: ${result.entries} participante(s).`
  );
};

export const handleGiveawayReroll: CommandHandler = async (_parsed, ctx) => {
  const isStaff = isBroadcasterOrMod(ctx.message.sender.identity.badges);
  if (!isStaff) {
    await sendMessage(ctx.broadcasterId, "Apenas moderação pode fazer reroll.");
    return;
  }

  const result = await giveawayService.reroll(ctx.channelSlug);
  if (!result.ok) {
    await sendMessage(ctx.broadcasterId, result.error);
    return;
  }

  await sendMessage(
    ctx.broadcasterId,
    `🔄 Reroll do sorteio (${result.prize}): novo vencedor @${result.winner.username}!`
  );
  broadcastAlert({
    type: "giveaway_reroll",
    channelSlug: ctx.channelSlug,
    title: "Reroll do sorteio",
    message: `Novo vencedor: @${result.winner.username}`,
    metadata: { giveawayId: result.giveawayId, prize: result.prize },
  });
};

export const handlePoll: CommandHandler = async (parsed, ctx) => {
  const isStaff = isBroadcasterOrMod(ctx.message.sender.identity.badges);
  const sub = parsed.subcommand;

  if (sub === "status") {
    const poll = await pollService.getOpen(ctx.channelSlug);
    if (!poll) {
      await sendMessage(ctx.broadcasterId, "Nenhuma enquete aberta no momento.");
      return;
    }
    const options = poll.options
      .map((opt: string, i: number) => `${i + 1}) ${opt}`)
      .join(" | ");
    await sendMessage(
      ctx.broadcasterId,
      `📊 Enquete ativa: ${poll.question} | ${options} | Vote com !votar <número>`
    );
    return;
  }

  if (sub === "end") {
    if (!isStaff) {
      await sendMessage(ctx.broadcasterId, "Apenas moderação pode encerrar enquete.");
      return;
    }
    const closed = await pollService.close(ctx.channelSlug);
    if (!closed.ok) {
      await sendMessage(ctx.broadcasterId, closed.error);
      return;
    }
    await sendMessage(
      ctx.broadcasterId,
      `📊 Enquete encerrada: ${closed.question}. Resultado: ${
        closed.winnerText ? `"${closed.winnerText}"` : "sem vencedor"
      } (${closed.totalVotes} voto(s)).`
    );
    broadcastAlert({
      type: "poll_result",
      channelSlug: ctx.channelSlug,
      title: "Resultado da enquete",
      message: closed.winnerText
        ? `Vencedor: ${closed.winnerText}`
        : "Enquete encerrada sem votos.",
      metadata: { pollId: closed.pollId, totalVotes: closed.totalVotes },
    });
    return;
  }

  if (sub !== "start") {
    await sendMessage(
      ctx.broadcasterId,
      "Uso: !poll start pergunta | opcao1 | opcao2 [| opcao3...] | !poll status | !poll end"
    );
    return;
  }

  if (!isStaff) {
    await sendMessage(ctx.broadcasterId, "Apenas moderação pode iniciar enquete.");
    return;
  }

  const raw = parsed.rawArgs.trim();
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) {
    await sendMessage(
      ctx.broadcasterId,
      "Formato inválido. Use: !poll start pergunta | opcao1 | opcao2 [| opcao3...]"
    );
    return;
  }

  const [question, ...options] = parts;
  try {
    const poll = await pollService.create(ctx.channelSlug, question!, options);
    const line = poll.options
      .map((o: string, i: number) => `${i + 1}) ${o}`)
      .join(" | ");
    await sendMessage(
      ctx.broadcasterId,
      `📊 Nova enquete: ${poll.question} | ${line} | Vote com !votar <número> (${poll.durationS}s)`
    );
    broadcastAlert({
      type: "poll_open",
      channelSlug: ctx.channelSlug,
      title: "Nova enquete",
      message: poll.question,
      metadata: { pollId: poll.id, options: poll.options },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sendMessage(ctx.broadcasterId, message);
  }
};

export const handlePollVote: CommandHandler = async (parsed, ctx) => {
  const option = Number.parseInt(parsed.args[0] ?? "", 10);
  const vote = await pollService.vote(ctx.channelSlug, {
    kickUserId: ctx.message.sender.id,
    username: ctx.message.sender.username,
    badges: ctx.message.sender.identity.badges,
  }, option);

  if (!vote.ok) {
    await sendMessage(ctx.broadcasterId, `@${ctx.message.sender.username} ${vote.error}`);
    return;
  }

  await sendMessage(
    ctx.broadcasterId,
    `@${ctx.message.sender.username} voto confirmado na opção ${option}.`
  );
};
