/**
 * Serviço de enquetes (Fase 4).
 */

import { prisma } from "../infra/prisma/client.js";
import { broadcastPollUpdate } from "../api/alertEvents.js";

export interface PollUser {
  kickUserId: number;
  username: string;
  badges: Array<{ type: string; text: string }>;
}

interface PollTimerMap {
  [pollId: string]: ReturnType<typeof setTimeout>;
}

const pollTimers: PollTimerMap = {};

function hasSubBadge(badges: PollUser["badges"]): boolean {
  return badges.some((b) => {
    const t = b.type.toLowerCase();
    return t === "subscriber" || t === "broadcaster";
  });
}

function buildPollResults(
  options: string[],
  votes: Array<{ option: number; weight: number }>
) {
  const tally = new Map<number, number>();
  for (const vote of votes) {
    tally.set(vote.option, (tally.get(vote.option) ?? 0) + vote.weight);
  }
  const totalVotes = [...tally.values()].reduce((sum, score) => sum + score, 0);
  const results = options.map((text, index) => {
    const option = index + 1;
    const score = tally.get(option) ?? 0;
    return {
      option,
      text,
      score,
      percentage: totalVotes > 0 ? Math.round((score / totalVotes) * 100) : 0,
    };
  });
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const winnerOption = winner && winner.score > 0 ? winner.option : null;
  const winnerText = winnerOption ? options[winnerOption - 1] ?? null : null;
  return { results, totalVotes, winnerOption, winnerText };
}

export class PollService {
  async create(
    channelSlug: string,
    question: string,
    options: string[],
    durationS = 60,
    weightedSubs = false
  ) {
    const existing = await this.getOpen(channelSlug);
    if (existing) {
      throw new Error("Já existe uma enquete aberta neste canal.");
    }
    if (options.length < 2) {
      throw new Error("A enquete precisa de pelo menos 2 opções.");
    }

    const poll = await prisma.poll.create({
      data: {
        channelSlug,
        question,
        options,
        durationS: Math.max(15, Math.floor(durationS)),
        weightedSubs,
        status: "open",
        closesAt: new Date(Date.now() + Math.max(15, Math.floor(durationS)) * 1000),
      },
    });

    pollTimers[poll.id] = setTimeout(() => {
      void this.closeById(poll.id);
    }, poll.durationS * 1000);

    broadcastPollUpdate({
      channelSlug: poll.channelSlug,
      pollId: poll.id,
      question: poll.question,
      options: poll.options,
      status: "open",
      totalVotes: 0,
      weightedSubs: poll.weightedSubs,
      results: poll.options.map((text, index) => ({
        option: index + 1,
        text,
        score: 0,
        percentage: 0,
      })),
      winnerOption: null,
      winnerText: null,
      closesAt: poll.closesAt?.toISOString() ?? null,
      closedAt: null,
      source: "created",
    });

    return poll;
  }

  async getOpen(channelSlug: string) {
    return prisma.poll.findFirst({
      where: { channelSlug, status: "open" },
      orderBy: { createdAt: "desc" },
      include: { votes: true },
    });
  }

  async listRecent(channelSlug: string, limit = 20) {
    return prisma.poll.findMany({
      where: { channelSlug },
      orderBy: { createdAt: "desc" },
      include: { votes: true },
      take: limit,
    });
  }

  async vote(
    channelSlug: string,
    user: PollUser,
    option: number
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const poll = await this.getOpen(channelSlug);
    if (!poll) return { ok: false, error: "Nenhuma enquete aberta no momento." };

    if (!Number.isFinite(option) || option < 1 || option > poll.options.length) {
      return { ok: false, error: "Opção inválida para votação." };
    }

    const weight = poll.weightedSubs && hasSubBadge(user.badges) ? 2 : 1;

    try {
      await prisma.pollVote.create({
        data: {
          pollId: poll.id,
          kickUserId: BigInt(user.kickUserId),
          username: user.username,
          option,
          weight,
        },
      });
      const refreshed = await prisma.poll.findUnique({
        where: { id: poll.id },
        include: { votes: true },
      });
      if (refreshed) {
        const live = buildPollResults(refreshed.options, refreshed.votes);
        broadcastPollUpdate({
          channelSlug: refreshed.channelSlug,
          pollId: refreshed.id,
          question: refreshed.question,
          options: refreshed.options,
          status: "open",
          totalVotes: live.totalVotes,
          weightedSubs: refreshed.weightedSubs,
          results: live.results,
          winnerOption: null,
          winnerText: null,
          closesAt: refreshed.closesAt?.toISOString() ?? null,
          closedAt: refreshed.closedAt?.toISOString() ?? null,
          source: "vote",
        });
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unique constraint")) {
        return { ok: false, error: "Você já votou nesta enquete." };
      }
      return { ok: false, error: "Falha ao registrar voto." };
    }
  }

  async close(channelSlug: string): Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        pollId: string;
        question: string;
        winnerOption: number | null;
        winnerText: string | null;
        totalVotes: number;
        results: Array<{ option: number; text: string; score: number }>;
      }
  > {
    const open = await this.getOpen(channelSlug);
    if (!open) return { ok: false, error: "Nenhuma enquete aberta para encerrar." };
    return this.closeById(open.id);
  }

  async closeById(
    pollId: string
  ): Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        pollId: string;
        question: string;
        winnerOption: number | null;
        winnerText: string | null;
        totalVotes: number;
        results: Array<{ option: number; text: string; score: number }>;
      }
  > {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { votes: true },
    });
    if (!poll) return { ok: false, error: "Enquete não encontrada." };
    if (poll.status !== "open") {
      return { ok: false, error: "Enquete já encerrada." };
    }

    const { results, totalVotes, winnerOption, winnerText } = buildPollResults(
      poll.options,
      poll.votes
    );

    if (pollTimers[poll.id]) {
      clearTimeout(pollTimers[poll.id]);
      delete pollTimers[poll.id];
    }

    await prisma.poll.update({
      where: { id: poll.id },
      data: {
        status: "closed",
        winnerOption,
        closedAt: new Date(),
      },
    });

    broadcastPollUpdate({
      channelSlug: poll.channelSlug,
      pollId: poll.id,
      question: poll.question,
      options: poll.options,
      status: "closed",
      totalVotes,
      weightedSubs: poll.weightedSubs,
      results,
      winnerOption,
      winnerText,
      closesAt: poll.closesAt?.toISOString() ?? null,
      closedAt: new Date().toISOString(),
      source: "closed",
    });

    return {
      ok: true,
      pollId: poll.id,
      question: poll.question,
      winnerOption,
      winnerText,
      totalVotes,
      results,
    };
  }
}

export const pollService = new PollService();
