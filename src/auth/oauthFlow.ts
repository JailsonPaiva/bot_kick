/**
 * Fluxo OAuth 2.1 com PKCE para autenticação na Kick.
 * Gera code_verifier/challenge, abre browser, recebe callback e troca code por tokens.
 */

import crypto from "node:crypto";
import express, { type Request, type Response } from "express";
import axios from "axios";
import open from "open";
import type { OAuthConfig, TokenResponse } from "./types.js";
import { saveTokens } from "./tokenStore.js";
import { logger } from "../utils/logger.js";
import { KICK_OAUTH_SCOPES } from "./oauthScopes.js";

const TOKEN_URL = "https://id.kick.com/oauth/token";
const AUTH_URL = "https://id.kick.com/oauth/authorize";
const CALLBACK_PORT = 3000;

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}

function generateState(): string {
  return base64UrlEncode(crypto.randomBytes(16));
}

function buildAuthUrl(config: OAuthConfig, challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(
  config: OAuthConfig,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier,
  });

  try {
    const response = await axios.post<TokenResponse>(TOKEN_URL, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      throw new Error(`Falha ao trocar code por token: ${detail}`);
    }
    throw error;
  }
}

function tokensFromResponse(response: TokenResponse) {
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + response.expires_in,
  };
}

export function loadOAuthConfig(): OAuthConfig {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "KICK_CLIENT_ID e KICK_CLIENT_SECRET devem estar definidos no .env"
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `http://localhost:${CALLBACK_PORT}/callback`,
    scopes: [...KICK_OAUTH_SCOPES],
  };
}

export async function runOAuthFlow(config?: OAuthConfig): Promise<void> {
  const oauthConfig = config ?? loadOAuthConfig();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  const authUrl = buildAuthUrl(oauthConfig, codeChallenge, state);

  logger.info("Iniciando fluxo OAuth 2.1 com PKCE...");
  logger.info(`Redirect URI: ${oauthConfig.redirectUri}`);
  logger.info(`Scopes: ${oauthConfig.scopes.join(" ")}`);

  return new Promise<void>((resolve, reject) => {
    const app = express();
    let serverClosed = false;

    const closeServer = (): void => {
      if (serverClosed) return;
      serverClosed = true;
      server.close(() => {
        logger.info("Servidor OAuth encerrado");
      });
    };

    app.get("/callback", async (req: Request, res: Response) => {
      const { code, state: returnedState, error, error_description } = req.query;

      if (error) {
        const msg = `${String(error)}: ${String(error_description ?? "")}`;
        logger.error("Erro retornado pelo OAuth", msg);
        res.status(400).send(`Autenticação falhou: ${msg}`);
        closeServer();
        reject(new Error(msg));
        return;
      }

      if (typeof code !== "string" || typeof returnedState !== "string") {
        const msg = "Callback inválido: code ou state ausente";
        logger.error(msg);
        res.status(400).send(msg);
        closeServer();
        reject(new Error(msg));
        return;
      }

      if (returnedState !== state) {
        const msg = "State inválido — possível ataque CSRF";
        logger.error(msg);
        res.status(400).send(msg);
        closeServer();
        reject(new Error(msg));
        return;
      }

      try {
        logger.info("Code recebido, trocando por tokens...");
        const tokenResponse = await exchangeCodeForTokens(
          oauthConfig,
          code,
          codeVerifier
        );
        await saveTokens(tokensFromResponse(tokenResponse));
        res.send(
          "<h1>Autenticação concluída!</h1><p>Você pode fechar esta aba e voltar ao terminal.</p>"
        );
        closeServer();
        resolve();
      } catch (err) {
        logger.error("Erro ao processar callback OAuth", err);
        res.status(500).send("Erro ao obter tokens. Verifique o terminal.");
        closeServer();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    const server = app.listen(CALLBACK_PORT, async () => {
      logger.info(`Servidor OAuth escutando em http://localhost:${CALLBACK_PORT}/callback`);
      logger.info("Abrindo browser para autorização...");
      try {
        await open(authUrl);
      } catch (err) {
        logger.warn("Não foi possível abrir o browser automaticamente", err);
        logger.info(`Abra manualmente: ${authUrl}`);
      }
    });

    server.on("error", (err) => {
      logger.error("Erro no servidor OAuth", err);
      closeServer();
      reject(err);
    });
  });
}
