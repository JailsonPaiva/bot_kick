/**
 * Scopes OAuth solicitados ao autorizar o app Kick.
 * @see https://docs.kick.com/getting-started/scopes
 */

export const KICK_OAUTH_SCOPES = [
  "user:read",
  "channel:read",
  "chat:write",
  "events:subscribe",
] as const;

export type KickOAuthScope = (typeof KICK_OAUTH_SCOPES)[number];

/** Scope mínimo exigido para webhooks de chat (Parte 4+). */
export const KICK_WEBHOOK_REQUIRED_SCOPES = ["events:subscribe"] as const;

export function parseScopeString(scope: string): string[] {
  return scope.trim().split(/\s+/).filter(Boolean);
}

export function missingScopes(
  grantedScope: string,
  required: readonly string[] = KICK_OAUTH_SCOPES
): string[] {
  const granted = new Set(parseScopeString(grantedScope));
  return required.filter((scope) => !granted.has(scope));
}

export function hasRequiredScopes(
  grantedScope: string,
  required: readonly string[] = KICK_OAUTH_SCOPES
): boolean {
  return missingScopes(grantedScope, required).length === 0;
}
