/**
 * Configuração centralizada de jogos, timeouts e limites do bot.
 * Valores podem ser sobrescritos via variáveis de ambiente.
 */

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

export const gameConfig = {
  /** Tempo máximo sem jogada antes de cancelar partida (ms) */
  gameTimeoutMs: parsePositiveInt(process.env.GAME_TIMEOUT_MS, 5 * 60 * 1000),

  /** Cooldown mínimo entre comandos do mesmo usuário (ms) */
  commandCooldownMs: parsePositiveInt(process.env.COMMAND_COOLDOWN_MS, 2 * 1000),

  /** Máximo de partidas ativas por canal */
  maxActiveGames: parsePositiveInt(process.env.MAX_ACTIVE_GAMES, 1),

  /** Prefixo [BOT] nas mensagens enviadas ao chat */
  botMessagePrefix: parseBoolean(process.env.BOT_MESSAGE_PREFIX, true),

  /** Recuperar partidas active do banco ao iniciar o bot */
  recoverGamesOnBoot: parseBoolean(process.env.RECOVER_GAMES_ON_BOOT, true),
} as const;
