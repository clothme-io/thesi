import {
  averageUgcViews,
  buildSelfReportedStats,
  creatorProfileSeedFromApplication,
  mapApplicationFollowerRange,
  nativeStatsFromInvites,
} from './follower-range.util';

describe('follower-range.util', () => {
  it('maps application buckets onto directory ranges', () => {
    expect(mapApplicationFollowerRange('5K+')).toBe('5k+');
    expect(mapApplicationFollowerRange('1K-5K')).toBe('1k-5k');
    expect(mapApplicationFollowerRange('500-1K')).toBe('500-1k');
    expect(mapApplicationFollowerRange('0-500')).toBe('0-500');
    expect(mapApplicationFollowerRange('')).toBe('');
  });

  it('sums entered platform follower counts and skips empty platforms', () => {
    expect(
      buildSelfReportedStats({
        tiktok: '@ava',
        instagram: '',
        youtube: 'https://youtube.com/@ava',
        tiktokFollowers: 4200,
        instagramFollowers: 800,
        youtubeFollowers: 0,
        avgViews: 1500,
        avgEngagementRate: 4.2,
      }),
    ).toEqual({
      totalFollowers: 5000,
      avgViews: 1500,
      avgEngagementRate: 4.2,
      platforms: [
        {
          platform: 'TikTok',
          followers: 4200,
          avgViews: 0,
          engagementRate: 0,
        },
        {
          platform: 'Instagram',
          followers: 800,
          avgViews: 0,
          engagementRate: 0,
        },
        {
          platform: 'YouTube',
          followers: 0,
          avgViews: 0,
          engagementRate: 0,
        },
      ],
    });
  });

  it('computes Thesi-native campaign and response stats from invites', () => {
    expect(nativeStatsFromInvites([])).toEqual({
      completedCampaigns: 0,
      responseRate: 0,
    });
    expect(
      nativeStatsFromInvites(['accepted', 'declined', 'sent', 'accepted']),
    ).toEqual({
      completedCampaigns: 2,
      responseRate: 75,
    });
  });

  it('averages UGC views when typical views were not entered', () => {
    expect(averageUgcViews([{ views: 0 }, { views: 1000 }, { views: 500 }])).toBe(
      750,
    );
    expect(averageUgcViews([{ views: 0 }])).toBe(0);
  });

  it('seeds a creator profile from the application', () => {
    expect(
      creatorProfileSeedFromApplication({
        fullName: 'Ava Chen',
        city: 'Los Angeles',
        country: 'USA',
        tiktokUrl: 'https://tiktok.com/@ava',
        instagramUrl: 'https://instagram.com/ava',
        youtubeUrl: null,
        followerCountRange: '5K+',
        portfolioLink: 'https://ava.example',
      }),
    ).toMatchObject({
      displayName: 'Ava Chen',
      location: 'Los Angeles, USA',
      followerRange: '5k+',
      platforms: ['TikTok', 'Instagram'],
      portfolioUrl: 'https://ava.example',
    });
  });
});
