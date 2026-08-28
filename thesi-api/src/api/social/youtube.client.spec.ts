import {
  fetchYouTubeChannelStats,
  fetchYouTubeRecentVideos,
} from './youtube.client';

describe('youtube.client', () => {
  it('maps channels.list statistics', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'UCxxxxxxxxxxxxxxxxxxxxxx',
            snippet: { title: 'Ava Chen', customUrl: '@ava' },
            statistics: { subscriberCount: '1234', viewCount: '9000' },
            contentDetails: { relatedPlaylists: { uploads: 'UU1' } },
          },
        ],
      }),
    });

    await expect(
      fetchYouTubeChannelStats(
        'test-key',
        { kind: 'handle', handle: 'ava' },
        fetchFn as unknown as typeof fetch,
      ),
    ).resolves.toEqual({
      channelId: 'UCxxxxxxxxxxxxxxxxxxxxxx',
      handle: 'ava',
      title: 'Ava Chen',
      subscriberCount: 1234,
      viewCount: 9000,
      videoCount: 0,
      uploadsPlaylistId: 'UU1',
    });

    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain('forHandle=%40ava');
    expect(url).toContain('key=test-key');
  });

  it('returns an empty list when playlist lookup fails', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(
      fetchYouTubeRecentVideos(
        'test-key',
        'UU1',
        fetchFn as unknown as typeof fetch,
      ),
    ).resolves.toEqual([]);
  });
});
