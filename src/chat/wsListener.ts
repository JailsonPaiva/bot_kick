/**
 * Listener WebSocket via Pusher para receber mensagens do chat da Kick.
 * Conecta, assina o canal do chatroom, emite ChatMessage e reconecta com backoff.
 */

import { EventEmitter } from "node:events";
import WebSocket from "ws";
import axios from "axios";
import type { ChatMessage, ChannelResponse, KickEvent } from "./types.js";
import { logger } from "../utils/logger.js";

const PUSHER_APP_KEY = "32cbd69e4b950bf97679";
const PUSHER_WS_URL = `wss://ws-us2.pusher.com/app/${PUSHER_APP_KEY}?protocol=7&client=js&version=7.6.0&flash=false`;
const CHAT_EVENT = "App\\Events\\ChatMessageEvent";
const PING_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export interface WsListenerEvents {
  message: (msg: ChatMessage) => void;
  connected: () => void;
  disconnected: () => void;
  error: (err: Error) => void;
}

export class WsListener extends EventEmitter {
  private ws: WebSocket | null = null;
  private chatroomId: number;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private intentionalClose = false;

  constructor(chatroomId: number) {
    super();
    this.chatroomId = chatroomId;
  }

  connect(): void {
    this.intentionalClose = false;
    this.openConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    logger.info("WebSocket desconectado (intencional)");
  }

  private openConnection(): void {
    logger.info(`Conectando ao WebSocket Pusher (chatroom ${this.chatroomId})...`);

    const ws = new WebSocket(PUSHER_WS_URL);
    this.ws = ws;

    ws.on("open", () => {
      logger.info("WebSocket conectado, aguardando connection_established...");
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      this.handleRawMessage(raw.toString());
    });

    ws.on("close", (code, reason) => {
      this.clearPingTimer();
      logger.warn(`WebSocket fechado (code=${code}, reason=${reason.toString()})`);
      this.emit("disconnected");

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    ws.on("error", (err: Error) => {
      logger.error("Erro no WebSocket", err);
      this.emit("error", err);
    });
  }

  private handleRawMessage(raw: string): void {
    let parsed: KickEvent;

    try {
      parsed = JSON.parse(raw) as KickEvent;
    } catch {
      logger.debug(`Mensagem WS não-JSON ignorada: ${raw.slice(0, 100)}`);
      return;
    }

    switch (parsed.event) {
      case "pusher:connection_established":
        this.onConnectionEstablished();
        break;

      case "pusher:pong":
        logger.debug("Pusher pong recebido");
        break;

      case "pusher:ping":
        this.send({ event: "pusher:pong", data: {} });
        break;

      case CHAT_EVENT:
        this.onChatMessage(parsed.data);
        break;

      default:
        logger.debug(`Evento WS ignorado: ${parsed.event}`);
    }
  }

  private onConnectionEstablished(): void {
    this.backoffMs = INITIAL_BACKOFF_MS;
    logger.info("Conexão Pusher estabelecida — assinando canal do chat...");

    this.send({
      event: "pusher:subscribe",
      data: { channel: `chatrooms.${this.chatroomId}.v2` },
    });

    this.startPingTimer();
    this.emit("connected");
  }

  private onChatMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ChatMessage;
      this.emit("message", message);
    } catch (err) {
      logger.error("Erro ao parsear ChatMessageEvent", err);
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startPingTimer(): void {
    this.clearPingTimer();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        logger.debug("Enviando pusher:ping");
        this.send({ event: "pusher:ping", data: {} });
      }
    }, PING_INTERVAL_MS);
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearPingTimer();
    this.clearReconnectTimer();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    logger.info(`Reconectando em ${this.backoffMs}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    }, this.backoffMs);
  }
}

const CLOUDFLARE_403_HELP = `
A Kick bloqueia requisições automatizadas ao endpoint /api/v2/channels (Cloudflare 403).
Isso NÃO significa necessariamente que o slug está errado.

Como obter o KICK_CHATROOM_ID manualmente:
1. Abra seu canal no browser: https://kick.com/<seu-slug>
2. No mesmo browser, acesse: https://kick.com/api/v2/channels/<seu-slug>
3. Procure no JSON: "chatroom": { "id": 123456 }
4. Coloque esse número no .env como KICK_CHATROOM_ID=123456

Como descobrir o slug correto (KICK_CHANNEL_SLUG):
- É a parte da URL após kick.com/ (ex: kick.com/unao-da-firma → unao-da-firma)
- Não é o nome de exibição; use hífens (-), não underscores (_)
- Abra seu perfil/canal e copie exatamente o que aparece na barra de endereço
`.trim();

function chatroomIdFromEnv(): number | null {
  const raw = process.env.KICK_CHATROOM_ID?.trim();
  if (!raw) return null;

  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(`KICK_CHATROOM_ID inválido no .env: "${raw}"`);
  }

  return id;
}

export async function resolveChatroomId(channelSlug: string): Promise<number> {
  const fromEnv = chatroomIdFromEnv();
  if (fromEnv !== null) {
    logger.info(`Usando KICK_CHATROOM_ID do .env: ${fromEnv}`);
    return fromEnv;
  }

  return fetchChatroomId(channelSlug);
}

export async function fetchChatroomId(channelSlug: string): Promise<number> {
  const url = `https://kick.com/api/v2/channels/${encodeURIComponent(channelSlug)}`;

  try {
    const response = await axios.get<ChannelResponse>(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: `https://kick.com/${channelSlug}`,
        Origin: "https://kick.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    const chatroomId = response.data.chatroom?.id;
    if (typeof chatroomId !== "number") {
      throw new Error(`chatroom.id não encontrado para o canal "${channelSlug}"`);
    }

    logger.info(`Chatroom ID do canal "${channelSlug}": ${chatroomId}`);
    return chatroomId;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 403) {
        throw new Error(
          `Kick bloqueou a busca automática do canal "${channelSlug}" (HTTP 403).\n${CLOUDFLARE_403_HELP}`
        );
      }

      if (status === 404) {
        throw new Error(
          `Canal "${channelSlug}" não encontrado (HTTP 404). Verifique KICK_CHANNEL_SLUG na URL do seu canal (ex: kick.com/seu-slug).`
        );
      }

      throw new Error(
        `Falha ao buscar canal "${channelSlug}" (HTTP ${status ?? "?"}): ${error.message}`
      );
    }
    throw error;
  }
}
