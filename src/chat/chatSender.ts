/**
 * Envio de mensagens no chat da Kick via API REST.
 * Fila sequencial com retry/backoff em 429 e truncamento automático a 500 chars.
 */

import axios, { type AxiosError } from "axios";
import { getValidToken } from "../auth/authManager.js";
import { gameConfig } from "../config/gameConfig.js";
import { logger } from "../utils/logger.js";

const CHAT_URL = "https://api.kick.com/public/v1/chat";
const MAX_MESSAGE_LENGTH = 500;

interface SendMessageBody {
  broadcaster_user_id: number;
  content: string;
  type: "user" | "bot";
}

interface QueuedMessage {
  broadcasterId: number;
  content: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

let queue: QueuedMessage[] = [];
let processing = false;

function formatChatContent(content: string): string {
  const trimmed = content.trim();
  if (!gameConfig.botMessagePrefix || trimmed.startsWith("[BOT]")) {
    return trimmed;
  }
  return `[BOT] ${trimmed}`;
}

function truncateContent(content: string): string {
  const formatted = formatChatContent(content);
  if (formatted.length <= MAX_MESSAGE_LENGTH) {
    return formatted;
  }
  logger.warn(
    `Mensagem truncada de ${formatted.length} para ${MAX_MESSAGE_LENGTH} caracteres`
  );
  return formatted.slice(0, MAX_MESSAGE_LENGTH);
}

async function postMessage(
  broadcasterId: number,
  content: string
): Promise<void> {
  const token = await getValidToken();
  const body: SendMessageBody = {
    broadcaster_user_id: broadcasterId,
    content: truncateContent(content),
    type: "user",
  };

  try {
    await axios.post(CHAT_URL, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (status === 429) {
        const retryAfterHeader = axiosError.response?.headers["retry-after"];
        const retrySeconds = parseRetryAfter(retryAfterHeader);
        logger.warn(`Rate limit (429) — aguardando ${retrySeconds}s antes de reenviar`);
        await sleep(retrySeconds * 1000);
        return postMessage(broadcasterId, content);
      }

      const detail = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;
      throw new Error(`Falha ao enviar mensagem (HTTP ${status ?? "?"}): ${detail}`);
    }
    throw error;
  }
}

function parseRetryAfter(header: string | string[] | undefined): number {
  if (!header) return 5;
  const value = Array.isArray(header) ? header[0] : header;
  const seconds = parseInt(value, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;

    try {
      await postMessage(item.broadcasterId, item.content);
      item.resolve();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("Erro ao enviar mensagem da fila", error);
      item.reject(error);
    }
  }

  processing = false;
}

export function sendMessage(broadcasterId: number, content: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    queue.push({ broadcasterId, content, resolve, reject });
    void processQueue();
  });
}
