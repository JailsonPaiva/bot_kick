/**
 * Parser de mensagens de chat no formato !comando [subcomando] [args...]
 */

import type { ParsedCommand } from "./types.js";

const COMMAND_PATTERN = /^!(\w+)(?:\s+([\s\S]*))?$/;

export function parseCommand(content: string): ParsedCommand | null {
  const trimmed = content.trim();
  const match = COMMAND_PATTERN.exec(trimmed);

  if (!match) {
    return null;
  }

  const command = match[1].toLowerCase();
  const remainder = (match[2] ?? "").trim();

  if (!remainder) {
    return {
      command,
      subcommand: null,
      args: [],
      rawArgs: "",
    };
  }

  const parts = remainder.split(/\s+/);
  const firstPart = parts[0]?.toLowerCase() ?? "";

  // Subcomandos conhecidos (extensível na Sprint 2+)
  const knownSubcommands = new Set([
    "join",
    "forfeit",
    "board",
    "web",
    "help",
    "challenge",
    "me",
    "start",
    "end",
    "status",
  ]);

  if (knownSubcommands.has(firstPart)) {
    const subArgs = parts.slice(1);
    return {
      command,
      subcommand: firstPart,
      args: subArgs,
      rawArgs: subArgs.join(" "),
    };
  }

  // Número isolado (ex: !ttt 5) ou args livres (ex: !echo olá mundo)
  return {
    command,
    subcommand: null,
    args: parts,
    rawArgs: remainder,
  };
}

export function isCommand(content: string): boolean {
  return content.trim().startsWith("!");
}
