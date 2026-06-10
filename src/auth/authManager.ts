/**
 * Facade de autenticação — gerencia tokens válidos e refresh automático.
 * Exporta getValidToken() que garante um access_token fresco (< 5 min do vencimento).
 */

import axios from "axios";
import type { OAuthConfig, OAuthTokens, TokenResponse } from "./types.js";
import { loadTokens, saveTokens, tokensExist, deleteTokens } from "./tokenStore.js";
import { loadOAuthConfig, runOAuthFlow } from "./oauthFlow.js";
import { logger } from "../utils/logger.js";

const TOKEN_URL = "https://id.kick.com/oauth/token";
const REFRESH_THRESHOLD_SECONDS = 5 * 60;

let cachedConfig: OAuthConfig | null = null;

function getConfig(): OAuthConfig {
  cachedConfig ??= loadOAuthConfig();
  return cachedConfig;
}

function isExpired(tokens: OAuthTokens): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return tokens.expires_at <= nowSeconds;
}

function isExpiringSoon(tokens: OAuthTokens): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return tokens.expires_at - nowSeconds < REFRESH_THRESHOLD_SECONDS;
}

async function refreshTokens(
  config: OAuthConfig,
  tokens: OAuthTokens
): Promise<OAuthTokens> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const timeLeft = tokens.expires_at - nowSeconds;
  
  if (timeLeft > 0) {
    logger.info(`Token expira em ${timeLeft}s — executando refresh...`);
  } else {
    logger.warn(`Token expirou há ${Math.abs(timeLeft)}s — tentando refresh...`);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  try {
    const response = await axios.post<TokenResponse>(TOKEN_URL, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const refreshed: OAuthTokens = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + response.data.expires_in,
    };

    await saveTokens(refreshed);
    logger.info("Tokens atualizados via refresh");
    return refreshed;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;

      if (status === 400 || status === 401) {
        logger.warn("Refresh token inválido/revogado — deletando tokens e forçando novo OAuth");
        await deleteTokens();
        throw new Error(
          `Refresh token inválido ou revogado. Reinicie o bot para fazer novo OAuth. Detalhe: ${detail}`
        );
      }
      throw new Error(`Falha ao renovar token (HTTP ${status ?? "?"}): ${detail}`);
    }
    throw error;
  }
}

export async function ensureAuthenticated(): Promise<OAuthTokens> {
  const hasTokens = await tokensExist();

  if (!hasTokens) {
    logger.info("Nenhum token encontrado — iniciando fluxo OAuth...");
    await runOAuthFlow();
  }

  let tokens = await loadTokens();
  if (!tokens) {
    throw new Error("Tokens não disponíveis após fluxo OAuth");
  }

  // Verificar se os tokens existentes já expiraram completamente
  if (isExpired(tokens)) {
    logger.warn("Tokens encontrados mas já expiraram — tentando refresh...");
    const config = getConfig();
    try {
      tokens = await refreshTokens(config, tokens);
    } catch (error) {
      // Se refresh falhar, deletar tokens e forçar novo OAuth
      logger.error("Refresh falhou — reiniciando fluxo OAuth completo");
      await deleteTokens();
      await runOAuthFlow();
      tokens = await loadTokens();
      if (!tokens) {
        throw new Error("Tokens não disponíveis após novo fluxo OAuth");
      }
    }
  }

  return tokens;
}

export async function getValidToken(): Promise<string> {
  let tokens = await loadTokens();

  if (!tokens) {
    tokens = await ensureAuthenticated();
  }

  if (isExpiringSoon(tokens)) {
    const config = getConfig();
    tokens = await refreshTokens(config, tokens);
  }

  return tokens.access_token;
}
