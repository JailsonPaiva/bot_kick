/**
 * Persistência local de tokens OAuth em arquivo .tokens.json.
 * Responsável por salvar, carregar e verificar existência de tokens.
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { OAuthTokens } from "./types.js";
import { logger } from "../utils/logger.js";

const TOKEN_FILE = path.resolve(process.cwd(), ".tokens.json");

export async function tokensExist(): Promise<boolean> {
  try {
    await access(TOKEN_FILE, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function loadTokens(): Promise<OAuthTokens | null> {
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (!isValidTokens(parsed)) {
      logger.warn("Arquivo .tokens.json inválido ou corrompido");
      return null;
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    logger.error("Erro ao carregar tokens", error);
    return null;
  }
}

export async function saveTokens(tokens: OAuthTokens): Promise<void> {
  try {
    await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
    logger.info("Tokens salvos em .tokens.json");
  } catch (error) {
    logger.error("Erro ao salvar tokens", error);
    throw new Error("Falha ao persistir tokens OAuth");
  }
}

export async function deleteTokens(): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(TOKEN_FILE);
    logger.info("Tokens deletados de .tokens.json");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn("Erro ao deletar tokens", error);
    }
  }
}

function isValidTokens(value: unknown): value is OAuthTokens {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.access_token === "string" &&
    typeof obj.refresh_token === "string" &&
    typeof obj.expires_at === "number"
  );
}
