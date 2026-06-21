/**
 * Tokens JWT de curta duração para jogadores na interface web.
 */

import jwt, { type SignOptions } from "jsonwebtoken";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./types.js";
import type { TttSymbol } from "../games/ttt/tttGame.js";

const JWT_SECRET = process.env.API_JWT_SECRET || "change-me-in-production";
const PLAYER_TOKEN_EXPIRY = process.env.PLAYER_TOKEN_EXPIRY || "10m";

export interface PlayerTokenPayload {
  role: "player";
  kickUserId: number;
  username: string;
  slug: string;
  channelSlug: string;
  gameId: string;
  symbol: TttSymbol | null;
}

export function generatePlayerToken(payload: Omit<PlayerTokenPayload, "role">): string {
  const options: SignOptions = { expiresIn: PLAYER_TOKEN_EXPIRY as SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, role: "player" }, JWT_SECRET, options);
}

export function verifyPlayerToken(token: string): PlayerTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as PlayerTokenPayload;
    if (payload.role !== "player") return null;
    return payload;
  } catch {
    return null;
  }
}

export function playerAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const queryToken =
    typeof req.query.token === "string" ? req.query.token : undefined;

  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : queryToken;

  if (!token) {
    res.status(401).json({ success: false, error: "Token não fornecido" });
    return;
  }

  const payload = verifyPlayerToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: "Token inválido ou expirado" });
    return;
  }

  req.player = payload;
  next();
}

export function buildPlayUrl(token: string): string {
  const base = process.env.WEB_PLAY_URL || "http://localhost:5173/play";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}
