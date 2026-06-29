/**
 * Reautenticação OAuth forçada — necessária ao adicionar novos scopes (ex.: events:subscribe).
 */

import { deleteTokens, loadTokens } from "./tokenStore.js";
import { runOAuthFlow } from "./oauthFlow.js";
import {
  KICK_OAUTH_SCOPES,
  KICK_WEBHOOK_REQUIRED_SCOPES,
} from "./oauthScopes.js";
import {
  formatScopeCheck,
  verifyAccessTokenScopes,
} from "./tokenIntrospect.js";
import { logger } from "../utils/logger.js";

export interface ReauthenticateResult {
  scopes: string;
  hasEventsSubscribe: boolean;
}

/**
 * Remove tokens locais, abre OAuth no browser e valida scopes via introspect.
 */
export async function forceReauthenticate(): Promise<ReauthenticateResult> {
  logger.info("=== Reautenticação OAuth Kick ===");
  logger.info(`Scopes solicitados: ${KICK_OAUTH_SCOPES.join(" ")}`);

  await deleteTokens();

  await runOAuthFlow();

  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error("OAuth concluído mas .tokens.json não foi criado");
  }

  const introspection = await verifyAccessTokenScopes(
    tokens.access_token,
    KICK_WEBHOOK_REQUIRED_SCOPES
  );

  logger.info(`Token ativo. ${formatScopeCheck(introspection)}`);
  logger.info("Reautenticação concluída — pode iniciar o bot com npm run dev");

  return {
    scopes: introspection.scope,
    hasEventsSubscribe: true,
  };
}
