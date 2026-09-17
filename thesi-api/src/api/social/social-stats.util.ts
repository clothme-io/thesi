import type { CreatorPlatformStatsJson } from 'src/dbConfig/drizzle/schema/creatorsDirectorySchema';

export function isConnectedSource(
  source?: string | null,
): boolean {
  return source === 'youtube' || source === 'tiktok' || source === 'instagram';
}

export function connectedPlatforms(
  platforms: CreatorPlatformStatsJson[] | null | undefined,
): CreatorPlatformStatsJson[] {
  return (platforms ?? []).filter((row) => isConnectedSource(row.source));
}

export function mergePlatformStats(
  selfReported: CreatorPlatformStatsJson[],
  existing: CreatorPlatformStatsJson[] | null | undefined,
): CreatorPlatformStatsJson[] {
  const connected = connectedPlatforms(existing);
  const connectedNames = new Set(connected.map((row) => row.platform));
  const next = selfReported
    .filter((row) => !connectedNames.has(row.platform))
    .map((row) => ({ ...row, source: row.source ?? 'self_reported' as const }));
  return [...connected, ...next];
}

export function upsertConnectedPlatform(
  existing: CreatorPlatformStatsJson[] | null | undefined,
  incoming: CreatorPlatformStatsJson,
): CreatorPlatformStatsJson[] {
  const rest = (existing ?? []).filter(
    (row) => row.platform !== incoming.platform,
  );
  return [...rest, incoming];
}

export function totalFollowersFrom(
  platforms: CreatorPlatformStatsJson[],
): number {
  return platforms.reduce((sum, row) => sum + (row.followers || 0), 0);
}

export function connectedAvgViews(
  platforms: CreatorPlatformStatsJson[],
): number {
  const connected = platforms.filter(
    (row) => isConnectedSource(row.source) && row.avgViews > 0,
  );
  if (connected.length === 0) return 0;
  return Math.round(
    connected.reduce((sum, row) => sum + row.avgViews, 0) / connected.length,
  );
}

export function engagementRateFromPosts(
  posts: { views: number; likes: number; comments: number }[],
): number {
  const withViews = posts.filter((post) => post.views > 0);
  if (withViews.length === 0) return 0;
  const interactions = withViews.reduce(
    (sum, post) => sum + post.likes + post.comments,
    0,
  );
  const views = withViews.reduce((sum, post) => sum + post.views, 0);
  return Math.round((interactions / views) * 10000) / 100;
}
