/**
 * Controle de cooldown por usuário e comando — anti-spam básico.
 */

import { gameConfig } from "../../config/gameConfig.js";

export class CooldownManager {
  private lastUsed = new Map<string, number>();

  private key(userId: number, commandPrefix: string): string {
    return `${userId}:${commandPrefix}`;
  }

  /** Retorna true se o comando pode ser executado agora. */
  tryConsume(userId: number, commandPrefix: string): boolean {
    const now = Date.now();
    const mapKey = this.key(userId, commandPrefix);
    const last = this.lastUsed.get(mapKey);

    if (last !== undefined && now - last < gameConfig.commandCooldownMs) {
      return false;
    }

    this.lastUsed.set(mapKey, now);
    return true;
  }

  remainingMs(userId: number, commandPrefix: string): number {
    const mapKey = this.key(userId, commandPrefix);
    const last = this.lastUsed.get(mapKey);
    if (last === undefined) return 0;

    const elapsed = Date.now() - last;
    return Math.max(0, gameConfig.commandCooldownMs - elapsed);
  }

  clear(): void {
    this.lastUsed.clear();
  }
}
