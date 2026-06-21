/**
 * Autenticação JWT para API do dashboard.
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import type { AuthRequest } from "./types.js";

const JWT_SECRET = process.env.API_JWT_SECRET || "change-me-in-production";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";

if (!ADMIN_PASSWORD_HASH && process.env.NODE_ENV === "production") {
  logger.warn("ADMIN_PASSWORD_HASH não configurado! Configure no .env para produção.");
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

export async function verifyPassword(password: string): Promise<boolean> {
  if (!ADMIN_PASSWORD_HASH) {
    // Desenvolvimento: permitir senha "admin" sem hash
    if (process.env.NODE_ENV !== "production") {
      return password === "admin";
    }
    return false;
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
