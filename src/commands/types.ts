/**
 * Tipos do sistema de roteamento de comandos do chat.
 */

import type { ChatMessage } from "../chat/types.js";

export interface CommandContext {
  message: ChatMessage;
  broadcasterId: number;
  botSlug: string;
  channelSlug: string;
  chatroomId: number;
}

export interface ParsedCommand {
  /** Nome do comando sem "!" (ex: echo, ping, ttt) */
  command: string;
  /** Subcomando opcional (ex: join em !ttt join) */
  subcommand: string | null;
  /** Argumentos tokenizados */
  args: string[];
  /** Texto bruto após comando/subcomando */
  rawArgs: string;
}

export type CommandHandler = (
  parsed: ParsedCommand,
  ctx: CommandContext
) => Promise<void>;
