/**
 * Autenticação JWT para API do dashboard.
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import type { AuthRequest } from "./types.js";

const DEFAULT_DEV_SECRET = "change-me-in-production";

function resolveJwtSecret(): string {
  const secret = process.env.API_JWT_SECRET ?? "";
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === DEFAULT_DEV_SECRET) {
      throw new Error("API_JWT_SECRET obrigatório e não-default em produção");
    }
    return secret;
  }
  if (!secret) {
    logger.warn("API_JWT_SECRET ausente — usando secret de desenvolvimento", {
      module: "auth",
    });
    return DEFAULT_DEV_SECRET;
  }
  return secret;
}

const JWT_SECRET = resolveJwtSecret();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 20;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

if (!ADMIN_PASSWORD_HASH && process.env.NODE_ENV === "production") {
  throw new Error("ADMIN_PASSWORD_HASH obrigatório em produção");
}

export interface JWTPayload {
  userId: string;
  role: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const row = loginAttempts.get(ip);
  if (!row || now > row.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  row.count += 1;
  return row.count > LOGIN_MAX_ATTEMPTS;
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (!ADMIN_PASSWORD_HASH) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return password === "admin";
  }

  return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Token não fornecido" });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ success: false, error: "Token inválido ou expirado" });
    return;
  }

  req.userId = payload.userId;
  next();
}
