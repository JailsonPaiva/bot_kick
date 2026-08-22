/**
 * Endpoints públicos (sem autenticação) para ranking.
 */

import { Router } from "express";
import axios from "axios";
import { prisma } from "../../infra/prisma/client.js";
import type { ApiResponse } from "../types.js";
import {
  mapGroupedPointsToRankingEntry,
  mapViewerPointsToRankingEntry,
} from "../publicRanking.js";
import {
  generateStoreViewerToken,
  normalizeViewerSlug,
  randomState,
  verifyStoreViewerToken,
} from "../storeViewerAuth.js";
import { loyaltyService } from "../../loyalty/loyaltyService.js";
import { storeService } from "../../loyalty/storeService.js";

const KICK_AUTHORIZE_URL = "https://id.kick.com/oauth/authorize";
const KICK_TOKEN_URL = "https://id.kick.com/oauth/token";
const KICK_USERS_URL = "https://api.kick.com/public/v1/users";
const STORE_SCOPE = "user:read";
const STORE_CALLBACK_PATH = "/api/public/store/oauth/callback";

const storeAuthState = new Map<string, { channelSlug: string; expiresAt: number }>();
const STORE_AUTH_STATE_TTL_MS = 10 * 60 * 1000;

type Period = "week" | "month" | "all";

function sinceDate(period: Period): Date | null {
  const now = new Date();
  if (period === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "month") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

export function createPublicRouter(): Router {
  const router = Router();

  function resolveApiBaseUrl(): string {
    const publicApiUrl = process.env.PUBLIC_API_URL?.trim();
    if (publicApiUrl) return publicApiUrl.replace(/\/+$/, "");
    const port = Number.parseInt(process.env.API_PORT || "3001", 10);
    return `http://localhost:${port}`;
  }

  function resolveStoreFrontendBaseUrl(): string {
    const value = process.env.WEB_STORE_URL?.trim();
    if (value) return value.replace(/\/+$/, "");
    return "http://localhost:3000/store";
  }

  function parseChannelSlug(raw: unknown): string {
    if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
    return String(raw ?? "").trim();
  }

  function cleanupStoreState() {
    const now = Date.now();
    for (const [key, value] of storeAuthState.entries()) {
      if (value.expiresAt <= now) {
        storeAuthState.delete(key);
      }
    }
  }

  function extractStoreViewerToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    if (!authHeader.startsWith("Bearer ")) return null;
    return authHeader.substring(7).trim() || null;
  }

  router.get("/public/ranking/:channelSlug", async (req, res) => {
    const channelSlug = Array.isArray(req.params.channelSlug)
      ? req.params.channelSlug[0]
      : req.params.channelSlug;
    const periodRaw = (req.query.period as string) ?? "all";
    const period = (["week", "month", "all"].includes(periodRaw)
      ? periodRaw
      : "all") as Period;
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit as string, 10) || 20, 1),
      100
    );

    try {
      if (period === "all") {
        const rows = await prisma.viewerPoints.findMany({
          where: { channelSlug },
          orderBy: [{ balance: "desc" }, { updatedAt: "asc" }],
          take: limit,
        });
        const ranking = rows.map(mapViewerPointsToRankingEntry);
        res.json({ success: true, data: { period, ranking } } satisfies ApiResponse);
        return;
      }

      const since = sinceDate(period)!;
      const grouped = await prisma.pointTransaction.groupBy({
        by: ["kickUserId"],
        where: { channelSlug, createdAt: { gte: since } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: limit,
      });

      const ids = grouped.map((g) => g.kickUserId);
      const viewers = await prisma.viewerPoints.findMany({
        where: { channelSlug, kickUserId: { in: ids } },
      });
      const map = new Map(viewers.map((v) => [v.kickUserId.toString(), v]));

      const ranking = grouped.map((g) =>
        mapGroupedPointsToRankingEntry(
          g.kickUserId,
          g._sum.amount ?? 0,
          map.get(g.kickUserId.toString())
        )
      );

      res.json({ success: true, data: { period, ranking } } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get("/public/store/:channelSlug/items", async (req, res) => {
    const channelSlug = parseChannelSlug(req.params.channelSlug);
    if (!channelSlug) {
      res.status(400).json({ success: false, error: "channelSlug inválido" });
      return;
    }

    try {
      const items = await storeService.listItems(channelSlug, false);
      const data = items.map((item) => ({
        id: item.id,
        channelSlug: item.channelSlug,
        code: item.code,
        title: item.title,
        description: item.description,
        costPoints: item.costPoints,
        stock: item.stock,
        cooldownSeconds: item.cooldownSeconds,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get("/public/store/:channelSlug/auth/start", async (req, res) => {
    const channelSlug = parseChannelSlug(req.params.channelSlug);
    if (!channelSlug) {
      res.status(400).json({ success: false, error: "channelSlug inválido" });
      return;
    }

    const clientId = process.env.KICK_CLIENT_ID?.trim();
    const clientSecret = process.env.KICK_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      res.status(500).json({
        success: false,
        error: "KICK_CLIENT_ID/KICK_CLIENT_SECRET não configurados",
      });
      return;
    }

    cleanupStoreState();
    const state = randomState();
    storeAuthState.set(state, {
      channelSlug,
      expiresAt: Date.now() + STORE_AUTH_STATE_TTL_MS,
    });

    const redirectUri = `${resolveApiBaseUrl()}${STORE_CALLBACK_PATH}`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: STORE_SCOPE,
      state,
    });
    res.redirect(`${KICK_AUTHORIZE_URL}?${params.toString()}`);
  });

  router.get("/public/store/oauth/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const error = typeof req.query.error === "string" ? req.query.error : "";
    const channelSlug = storeAuthState.get(state)?.channelSlug;
    const fallbackChannel = channelSlug || process.env.KICK_CHANNEL_SLUG || "canal";
    const redirectBase = `${resolveStoreFrontendBaseUrl()}/${encodeURIComponent(
      fallbackChannel
    )}`;

    if (error) {
      res.redirect(`${redirectBase}?authError=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state || !channelSlug) {
      res.redirect(`${redirectBase}?authError=state_or_code_invalid`);
      return;
    }

    cleanupStoreState();
    const stateData = storeAuthState.get(state);
    storeAuthState.delete(state);
    if (!stateData || stateData.expiresAt <= Date.now()) {
      res.redirect(`${redirectBase}?authError=state_expired`);
      return;
    }

    const clientId = process.env.KICK_CLIENT_ID?.trim();
    const clientSecret = process.env.KICK_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      res.redirect(`${redirectBase}?authError=oauth_config_missing`);
      return;
    }

    try {
      const redirectUri = `${resolveApiBaseUrl()}${STORE_CALLBACK_PATH}`;
      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const tokenResponse = await axios.post<{ access_token: string }>(
        KICK_TOKEN_URL,
        tokenBody.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new Error("access_token não retornado pela Kick");
      }

      const userResponse = await axios.get<{ data: Array<{ user_id: number; name: string }> }>(
        KICK_USERS_URL,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );
      const user = userResponse.data.data?.[0];
      if (!user) {
        throw new Error("Usuário da Kick não retornado");
      }

      const viewerToken = generateStoreViewerToken({
        channelSlug,
        kickUserId: user.user_id,
        username: user.name,
        slug: normalizeViewerSlug(user.name),
      });

      const redirectUrl = `${resolveStoreFrontendBaseUrl()}/${encodeURIComponent(
        channelSlug
      )}?viewerToken=${encodeURIComponent(viewerToken)}`;
      res.redirect(redirectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.redirect(`${redirectBase}?authError=${encodeURIComponent(message)}`);
    }
  });

  router.get("/public/store/:channelSlug/me", async (req, res) => {
    const channelSlug = parseChannelSlug(req.params.channelSlug);
    const token = extractStoreViewerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ success: false, error: "viewerToken não informado" });
      return;
    }
    const payload = verifyStoreViewerToken(token);
    if (!payload || payload.channelSlug !== channelSlug) {
      res.status(401).json({ success: false, error: "viewerToken inválido" });
      return;
    }

    try {
      const balance = await loyaltyService.getBalance(channelSlug, payload.kickUserId);
      const recent = await prisma.storeRedemption.findMany({
        where: {
          channelSlug,
          kickUserId: BigInt(payload.kickUserId),
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      res.json({
        success: true,
        data: {
          user: {
            kickUserId: String(payload.kickUserId),
            username: payload.username,
            slug: payload.slug,
          },
          balance,
          recentRedemptions: recent,
        },
      } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/public/store/:channelSlug/redeem", async (req, res) => {
    const channelSlug = parseChannelSlug(req.params.channelSlug);
    const token = extractStoreViewerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ success: false, error: "viewerToken não informado" });
      return;
    }
    const payload = verifyStoreViewerToken(token);
    if (!payload || payload.channelSlug !== channelSlug) {
      res.status(401).json({ success: false, error: "viewerToken inválido" });
      return;
    }

    const code = String(req.body?.code ?? "");
    const quantity = Number.parseInt(String(req.body?.quantity ?? "1"), 10);
    try {
      const result = await storeService.redeemByCode(
        channelSlug,
        {
          kickUserId: payload.kickUserId,
          username: payload.username,
          slug: payload.slug,
        },
        code,
        quantity
      );
      if (!result.ok) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
