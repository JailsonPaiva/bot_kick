/**
 * Consulta se o canal está em live na Kick (com cache curto).
 */

import axios from "axios";
import { getValidToken } from "../auth/authManager.js";
import { logger } from "../utils/logger.js";
import { runtimeHealth } from "../ops/runtimeHealth.js";
import {
  parseChannelLiveStatus,
  type ChannelLiveStatus,
} from "./channelLiveStatus.js";

const CHANNELS_API_URL = "https://api.kick.com/public/v1/channels";
const CACHE_TTL_MS = 20_000;

const cache = new Map<string, ChannelLiveStatus>();

export async function fetchChannelLiveStatus(
  channelSlug: string
): Promise<ChannelLiveStatus> {
  const slug = channelSlug.trim();
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached;
  }

  const offline: ChannelLiveStatus = {
    live: false,
    viewerCount: 0,
    subscriberCount: 0,
    liveDurationSeconds: 0,
    streamTitle: null,
    checkedAt: Date.now(),
  };

  if (!slug) return offline;

  try {
    const token = await getValidToken();
    const response = await axios.get(
      `${CHANNELS_API_URL}?slug=${encodeURIComponent(slug)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 8_000,
      }
    );

    const status = parseChannelLiveStatus(response.data);
    cache.set(slug, status);
    runtimeHealth.setViewerCount(slug, status.live ? status.viewerCount : 0);
    return status;
  } catch (err) {
    logger.warn("Falha ao consultar live na Kick", {
      module: "kick",
      channelSlug: slug,
    }, err);
    const fallback = cached ?? offline;
    return { ...fallback, checkedAt: Date.now() };
  }
}

export function __resetLiveStatusCacheForTests(): void {
  cache.clear();
}
