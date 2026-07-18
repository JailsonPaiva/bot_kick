/**
 * Tipos, defaults, validação e fórmula de bônus de membros do loyalty.
 */

export type LoyaltyEventType = "follow" | "subscription" | "gift_sub" | "raid";

export interface LoyaltyConfigData {
  channelSlug: string;
  chatEnabled: boolean;
  pointsPerChatActivity: number;
  chatIntervalSeconds: number;
  memberMultiplier: number;
  memberBonusFlat: number;
  eventFollowEnabled: boolean;
  eventFollowPoints: number;
  eventSubscriptionEnabled: boolean;
  eventSubscriptionPoints: number;
  eventGiftSubEnabled: boolean;
  eventGiftSubPoints: number;
  eventRaidEnabled: boolean;
  eventRaidPoints: number;
}

export type LoyaltyConfigUpdate = Partial<
  Omit<LoyaltyConfigData, "channelSlug">
>;

const envInt = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const DEFAULT_LOYALTY_CONFIG: Omit<LoyaltyConfigData, "channelSlug"> = {
  chatEnabled: true,
  pointsPerChatActivity: envInt("LOYALTY_POINTS_PER_ACTIVITY", 1),
  chatIntervalSeconds: envInt("LOYALTY_ACTIVITY_INTERVAL_SECONDS", 60),
  memberMultiplier: 1,
  memberBonusFlat: 0,
  eventFollowEnabled: false,
  eventFollowPoints: 0,
  eventSubscriptionEnabled: false,
  eventSubscriptionPoints: 0,
  eventGiftSubEnabled: false,
  eventGiftSubPoints: 0,
  eventRaidEnabled: false,
  eventRaidPoints: 0,
};

export interface MemberBonusConfig {
  memberMultiplier: number;
  memberBonusFlat: number;
}

/** final = floor(base * multiplier) + flat para membros; senão base */
export function applyMemberBonus(
  base: number,
  isMember: boolean,
  config: MemberBonusConfig
): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!isMember) return Math.floor(base);
  const mult = Number.isFinite(config.memberMultiplier)
    ? config.memberMultiplier
    : 1;
  const flat = Number.isFinite(config.memberBonusFlat)
    ? config.memberBonusFlat
    : 0;
  return Math.floor(base * mult) + Math.max(0, Math.floor(flat));
}

export function getEventRule(
  config: LoyaltyConfigData,
  eventType: LoyaltyEventType
): { enabled: boolean; points: number } {
  switch (eventType) {
    case "follow":
      return {
        enabled: config.eventFollowEnabled,
        points: config.eventFollowPoints,
      };
    case "subscription":
      return {
        enabled: config.eventSubscriptionEnabled,
        points: config.eventSubscriptionPoints,
      };
    case "gift_sub":
      return {
        enabled: config.eventGiftSubEnabled,
        points: config.eventGiftSubPoints,
      };
    case "raid":
      return {
        enabled: config.eventRaidEnabled,
        points: config.eventRaidPoints,
      };
  }
}

const POINTS_MIN = 0;
const POINTS_MAX = 100_000;
const INTERVAL_MIN = 10;
const INTERVAL_MAX = 3600;
const MULT_MIN = 1;
const MULT_MAX = 10;
const FLAT_MIN = 0;
const FLAT_MAX = 10_000;

function assertIntInRange(
  name: string,
  value: unknown,
  min: number,
  max: number
): string | null {
  if (value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return `${name} deve ser um inteiro`;
  }
  if (value < min || value > max) {
    return `${name} deve estar entre ${min} e ${max}`;
  }
  return null;
}

function assertNumberInRange(
  name: string,
  value: unknown,
  min: number,
  max: number
): string | null {
  if (value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${name} deve ser um número`;
  }
  if (value < min || value > max) {
    return `${name} deve estar entre ${min} e ${max}`;
  }
  return null;
}

export function validateLoyaltyConfigUpdate(
  update: LoyaltyConfigUpdate
): { ok: true } | { ok: false; error: string } {
  if (update.chatEnabled !== undefined && typeof update.chatEnabled !== "boolean") {
    return { ok: false, error: "chatEnabled deve ser boolean" };
  }

  const checks = [
    assertIntInRange(
      "pointsPerChatActivity",
      update.pointsPerChatActivity,
      POINTS_MIN,
      POINTS_MAX
    ),
    assertIntInRange(
      "chatIntervalSeconds",
      update.chatIntervalSeconds,
      INTERVAL_MIN,
      INTERVAL_MAX
    ),
    assertNumberInRange(
      "memberMultiplier",
      update.memberMultiplier,
      MULT_MIN,
      MULT_MAX
    ),
    assertIntInRange(
      "memberBonusFlat",
      update.memberBonusFlat,
      FLAT_MIN,
      FLAT_MAX
    ),
    assertIntInRange(
      "eventFollowPoints",
      update.eventFollowPoints,
      POINTS_MIN,
      POINTS_MAX
    ),
    assertIntInRange(
      "eventSubscriptionPoints",
      update.eventSubscriptionPoints,
      POINTS_MIN,
      POINTS_MAX
    ),
    assertIntInRange(
      "eventGiftSubPoints",
      update.eventGiftSubPoints,
      POINTS_MIN,
      POINTS_MAX
    ),
    assertIntInRange(
      "eventRaidPoints",
      update.eventRaidPoints,
      POINTS_MIN,
      POINTS_MAX
    ),
  ];

  for (const err of checks) {
    if (err) return { ok: false, error: err };
  }

  const boolFields: Array<keyof LoyaltyConfigUpdate> = [
    "eventFollowEnabled",
    "eventSubscriptionEnabled",
    "eventGiftSubEnabled",
    "eventRaidEnabled",
  ];
  for (const key of boolFields) {
    const v = update[key];
    if (v !== undefined && typeof v !== "boolean") {
      return { ok: false, error: `${key} deve ser boolean` };
    }
  }

  return { ok: true };
}

export const LOYALTY_EVENT_TYPES: LoyaltyEventType[] = [
  "follow",
  "subscription",
  "gift_sub",
  "raid",
];

export function isLoyaltyEventType(value: string): value is LoyaltyEventType {
  return (LOYALTY_EVENT_TYPES as string[]).includes(value);
}
