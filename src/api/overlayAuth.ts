/**
 * Tokens de acesso ao overlay público (OBS/browser source).
 */

import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.API_JWT_SECRET || "change-me-in-production";
const OVERLAY_TOKEN_EXPIRY =
  (process.env.OVERLAY_TOKEN_EXPIRY || "30d") as SignOptions["expiresIn"];

export interface OverlayTokenPayload {
  channelSlug: string;
  purpose: "overlay";
}

export function generateOverlayToken(channelSlug: string): string {
  return jwt.sign(
    { channelSlug, purpose: "overlay" } satisfies OverlayTokenPayload,
    JWT_SECRET,
    { expiresIn: OVERLAY_TOKEN_EXPIRY }
  );
}

export function verifyOverlayToken(token: string): OverlayTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as OverlayTokenPayload;
    if (payload.purpose !== "overlay" || !payload.channelSlug) return null;
    return payload;
  } catch {
    return null;
  }
}
