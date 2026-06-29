/**
 * Introspecção de access token OAuth (RFC 7662).
 * @see https://docs.kick.com/getting-started/oauth-2.1
 */

import axios from "axios";
import {
  hasRequiredScopes,
  missingScopes,
  type KickOAuthScope,
} from "./oauthScopes.js";

const INTROSPECT_URL = "https://id.kick.com/oauth/token/introspect";

export interface TokenIntrospectResult {
  active: boolean;
  scope: string;
  exp?: number;
  client_id?: string;
  token_type?: string;
}

interface IntrospectApiResponse {
  data?: {
    active?: boolean;
    scope?: string;
    exp?: number;
    client_id?: string;
    token_type?: string;
  };
  message?: string;
}

export async function introspectAccessToken(
  accessToken: string
): Promise<TokenIntrospectResult> {
  try {
    const response = await axios.post<IntrospectApiResponse>(
      INTROSPECT_URL,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        timeout: 15_000,
      }
    );

    const data = response.data.data;
    return {
      active: data?.active === true,
      scope: data?.scope ?? "",
      exp: data?.exp,
      client_id: data?.client_id,
      token_type: data?.token_type,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      throw new Error(
        `Falha ao introspectar token (HTTP ${error.response?.status ?? "?"}): ${detail}`
      );
    }
    throw error;
  }
}

export function assertTokenHasScopes(
  introspection: TokenIntrospectResult,
  required: readonly KickOAuthScope[] | readonly string[]
): void {
  if (!introspection.active) {
    throw new Error("Access token inativo após OAuth");
  }

  const missing = missingScopes(introspection.scope, required);
  if (missing.length > 0) {
    throw new Error(
      `Token sem scopes necessários: ${missing.join(", ")}. ` +
        `Concedidos: "${introspection.scope}". ` +
        "Confirme as permissões no Developer Portal e refaça o login."
    );
  }
}

export async function verifyAccessTokenScopes(
  accessToken: string,
  required: readonly KickOAuthScope[] | readonly string[] = ["events:subscribe"]
): Promise<TokenIntrospectResult> {
  const introspection = await introspectAccessToken(accessToken);
  assertTokenHasScopes(introspection, required);
  return introspection;
}

export function formatScopeCheck(introspection: TokenIntrospectResult): string {
  const ok = hasRequiredScopes(introspection.scope, ["events:subscribe"]);
  return ok
    ? `events:subscribe presente (scopes: ${introspection.scope})`
    : `events:subscribe AUSENTE (scopes: ${introspection.scope})`;
}
