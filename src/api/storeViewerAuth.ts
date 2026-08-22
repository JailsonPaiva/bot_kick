import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

const DEFAULT_SECRET = "change-me-in-production";
const VIEWER_TOKEN_EXPIRY = process.env.STORE_VIEWER_TOKEN_EXPIRY || "7d";

const JWT_SECRET = process.env.API_JWT_SECRET || DEFAULT_SECRET;

export interface StoreViewerTokenPayload {
  role: "store_viewer";
  channelSlug: string;
  kickUserId: number;
  username: string;
  slug: string;
}

export function normalizeViewerSlug(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "viewer";
}

export function generateStoreViewerToken(
  payload: Omit<StoreViewerTokenPayload, "role">
): string {
  const options: SignOptions = { expiresIn: VIEWER_TOKEN_EXPIRY as SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, role: "store_viewer" }, JWT_SECRET, {
    ...options,
  });
}

export function verifyStoreViewerToken(token: string): StoreViewerTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as StoreViewerTokenPayload;
    if (payload.role !== "store_viewer") return null;
    return payload;
  } catch {
    return null;
  }
}

export function randomState(): string {
  return crypto.randomBytes(16).toString("hex");
}
