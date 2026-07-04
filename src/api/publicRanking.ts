/**
 * Serialização do ranking público de loyalty — evita BigInt em res.json().
 */

export interface PublicRankingEntry {
  kickUserId: string;
  username: string;
  slug: string;
  points: number;
}

export function mapViewerPointsToRankingEntry(viewer: {
  kickUserId: bigint;
  username: string;
  slug: string;
  balance: number;
}): PublicRankingEntry {
  return {
    kickUserId: viewer.kickUserId.toString(),
    username: viewer.username,
    slug: viewer.slug,
    points: viewer.balance,
  };
}

export function mapGroupedPointsToRankingEntry(
  kickUserId: bigint,
  points: number,
  viewer?: { username: string; slug: string } | null
): PublicRankingEntry {
  const id = kickUserId.toString();
  return {
    kickUserId: id,
    username: viewer?.username ?? `user-${id}`,
    slug: viewer?.slug ?? `user-${id}`,
    points,
  };
}
