/**
 * Mapeia eventos webhook Kick → créditos de loyalty.
 */

import type { LoyaltyEventType } from "../loyalty/loyaltyConfig.js";
import type { LoyaltyUser } from "../loyalty/loyaltyService.js";
import type { KickWebhookPayload } from "./webhookTypes.js";

export interface LoyaltyWebhookAward {
  channelSlug: string;
  eventType: LoyaltyEventType;
  user: LoyaltyUser;
  isMember?: boolean;
}

type LoosePayload = KickWebhookPayload & Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickUser(
  ...candidates: Array<Record<string, unknown> | null | undefined>
): LoyaltyUser | null {
  for (const c of candidates) {
    if (!c) continue;
    const userId =
      (typeof c.user_id === "number" && c.user_id) ||
      (typeof c.id === "number" && c.id) ||
      (typeof c.userId === "number" && c.userId) ||
      0;
    const username =
      (typeof c.username === "string" && c.username) ||
      (typeof c.slug === "string" && c.slug) ||
      "";
    if (!username && !userId) continue;
    const slug =
      (typeof c.channel_slug === "string" && c.channel_slug) ||
      (typeof c.slug === "string" && c.slug) ||
      username.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    return {
      kickUserId: userId,
      username: username || `user-${userId}`,
      slug: slug || `user-${userId}`,
    };
  }
  return null;
}

function pickChannelSlug(
  payload: LoosePayload,
  fallback?: string
): string | null {
  const broadcaster = asRecord(payload.broadcaster);
  const channel = asRecord(payload.channel);
  const fromPayload =
    (typeof broadcaster?.channel_slug === "string" && broadcaster.channel_slug) ||
    (typeof channel?.slug === "string" && channel.slug) ||
    (typeof payload.channel_slug === "string" && payload.channel_slug) ||
    "";
  const slug = fromPayload.trim() || fallback?.trim() || "";
  return slug || null;
}

/** Mapeia Kick-Event-Type → tipo interno de loyalty */
export function mapKickEventToLoyaltyType(
  eventType: string
): LoyaltyEventType | null {
  const t = eventType.toLowerCase();
  if (t === "channel.followed" || t === "channel.follow") return "follow";
  if (
    t === "channel.subscription.new" ||
    t === "channel.subscription.renewal" ||
    t === "channel.subscriptions.new" ||
    (t.includes("subscription") && !t.includes("gift"))
  ) {
    return "subscription";
  }
  if (
    t === "channel.subscription.gifts" ||
    t === "channel.gifted_subscriptions" ||
    t.includes("gift")
  ) {
    return "gift_sub";
  }
  if (t === "channel.raid" || t === "channel.raided" || t.includes("raid")) {
    return "raid";
  }
  return null;
}

export function extractLoyaltyAwardFromWebhook(
  eventType: string,
  payload: KickWebhookPayload,
  fallbackChannelSlug?: string
): LoyaltyWebhookAward | null {
  const loyaltyType = mapKickEventToLoyaltyType(eventType);
  if (!loyaltyType) return null;

  const p = payload as LoosePayload;
  const channelSlug = pickChannelSlug(p, fallbackChannelSlug);
  if (!channelSlug) return null;

  const follower = asRecord(p.follower);
  const subscriber = asRecord(p.subscriber) ?? asRecord(p.user);
  const gifter = asRecord(p.gifter) ?? asRecord(p.sender);
  const raider = asRecord(p.raider) ?? asRecord(p.from);

  let user: LoyaltyUser | null = null;
  if (loyaltyType === "follow") {
    user = pickUser(follower, asRecord(p.user));
  } else if (loyaltyType === "subscription") {
    user = pickUser(subscriber, asRecord(p.user));
  } else if (loyaltyType === "gift_sub") {
    user = pickUser(gifter, subscriber, asRecord(p.user));
  } else {
    user = pickUser(raider, asRecord(p.user), asRecord(p.broadcaster));
  }

  if (!user) return null;

  return {
    channelSlug,
    eventType: loyaltyType,
    user,
    isMember:
      loyaltyType === "subscription" || loyaltyType === "gift_sub"
        ? true
        : undefined,
  };
}
