import {
  connectedAvgViews,
  engagementRateFromPosts,
  mergePlatformStats,
  totalFollowersFrom,
  upsertConnectedPlatform,
} from './social-stats.util';

describe('social-stats.util', () => {
  it('keeps connected platform rows when self-reported stats are saved', () => {
    const merged = mergePlatformStats(
      [
        {
          platform: 'YouTube',
          followers: 0,
          avgViews: 0,
          engagementRate: 0,
        },
        {
          platform: 'TikTok',
          followers: 1200,
          avgViews: 0,
          engagementRate: 0,
        },
      ],
      [
        {
          platform: 'YouTube',
          followers: 4800,
          avgViews: 900,
          engagementRate: 0,
          source: 'youtube',
        },
      ],
    );

    expect(merged).toEqual([
      {
        platform: 'YouTube',
        followers: 4800,
        avgViews: 900,
        engagementRate: 0,
        source: 'youtube',
      },
      {
        platform: 'TikTok',
        followers: 1200,
        avgViews: 0,
        engagementRate: 0,
        source: 'self_reported',
      },
    ]);
    expect(totalFollowersFrom(merged)).toBe(6000);
    expect(connectedAvgViews(merged)).toBe(900);
  });

  it('replaces a connected platform in place', () => {
    const next = upsertConnectedPlatform(
      [
        {
          platform: 'TikTok',
          followers: 10,
          avgViews: 0,
          engagementRate: 0,
          source: 'self_reported',
        },
      ],
      {
        platform: 'TikTok',
        followers: 5000,
        avgViews: 800,
        engagementRate: 0,
        source: 'tiktok',
      },
    );
    expect(next).toHaveLength(1);
    expect(next[0].followers).toBe(5000);
    expect(next[0].source).toBe('tiktok');
  });

  it('computes engagement from likes and comments over views', () => {
    expect(
      engagementRateFromPosts([{ views: 1000, likes: 80, comments: 20 }]),
    ).toBe(10);
    expect(
      engagementRateFromPosts([{ views: 0, likes: 10, comments: 1 }]),
    ).toBe(0);
  });
});
