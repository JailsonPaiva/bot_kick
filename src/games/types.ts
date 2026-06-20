/**
 * Tipos do motor de mini games — interfaces compartilhadas entre engine e jogos.
 */

import type { CommandContext, ParsedCommand } from "../commands/types.js";
import type { CooldownManager } from "./engine/cooldownManager.js";
import type { GameManager } from "./engine/gameManager.js";

export type SendChatFn = (
  broadcasterId: number,
  content: string
) => Promise<void>;

export interface SessionPlayer {
  dbId: number;
  kickUserId: number;
  username: string;
  slug: string;
}

export type SessionStatus = "waiting" | "active";

export interface ActiveGameSession {
  id: string;
  gameType: string;
  channelSlug: string;
  broadcasterId: number;
  playerX: SessionPlayer;
  playerO: SessionPlayer | null;
  state: Record<string, unknown>;
  status: SessionStatus;
  lastActivityAt: number;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  /** false enquanto aguarda oponente (ainda não gravado no SQLite) */
  persisted: boolean;
}

export interface GameHandlerContext {
  parsed: ParsedCommand;
  command: CommandContext;
  gameManager: GameManager;
  cooldown: CooldownManager;
  sendChat: SendChatFn;
}

export interface MiniGame {
  name: string;
  commandPrefix: string;
  handle(ctx: GameHandlerContext): Promise<void>;
}

export interface StartGameParams {
  channelSlug: string;
  broadcasterId: number;
  gameType: string;
  playerX: {
    kickUserId: number;
    username: string;
    slug: string;
  };
  initialState?: Record<string, unknown>;
}

export interface JoinGameParams {
  channelSlug: string;
  playerO: {
    kickUserId: number;
    username: string;
    slug: string;
  };
}

export type EndGameReason = "finished" | "forfeit" | "timeout" | "cancelled";

export interface EndGameParams {
  channelSlug: string;
  reason: EndGameReason;
  winnerDbId?: number | null;
  boardState?: Record<string, unknown>;
  announceMessage?: string;
}
