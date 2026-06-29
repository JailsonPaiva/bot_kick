/**
 * Public Key da Kick para validação de webhooks.
 * Busca em GET /public/v1/public-key com cache em memória.
 */

import axios from "axios";
import { logger } from "../utils/logger.js";

const PUBLIC_KEY_URL = "https://api.kick.com/public/v1/public-key";
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Chave documentada em https://docs.kick.com/events/webhook-security */
export const KICK_DOCUMENTED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

let cachedKey: string | null = null;
let cachedAt = 0;

export function resetKickPublicKeyCache(): void {
  cachedKey = null;
  cachedAt = 0;
}

export async function getKickWebhookPublicKey(): Promise<string> {
  const fromEnv = process.env.KICK_WEBHOOK_PUBLIC_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const now = Date.now();
  if (cachedKey && now - cachedAt < CACHE_TTL_MS) {
    return cachedKey;
  }

  try {
    const response = await axios.get<{ data?: { public_key?: string } }>(
      PUBLIC_KEY_URL,
      { headers: { Accept: "application/json" }, timeout: 10_000 }
    );
    const key = response.data.data?.public_key?.trim();
    if (key) {
      cachedKey = key;
      cachedAt = now;
      logger.info("[WEBHOOK] Public key Kick carregada da API");
      return key;
    }
  } catch (err) {
    logger.warn("[WEBHOOK] Falha ao buscar public key — usando chave documentada", err);
  }

  return KICK_DOCUMENTED_PUBLIC_KEY;
}
