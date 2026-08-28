import type { YouTubeChannelRef } from './parse-social-handle';

export type YouTubeChannelStats = {
  channelId: string;
  handle: string;
  title: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  uploadsPlaylistId?: string;
};

export type YouTubeVideoStats = {
  title: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
};

type FetchLike = typeof fetch;

function asCount(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchYouTubeChannelStats(
  apiKey: string,
  ref: YouTubeChannelRef,
  fetchFn: FetchLike = fetch,
): Promise<YouTubeChannelStats> {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    key: apiKey,
  });
  if (ref.kind === 'id') params.set('id', ref.id);
  else params.set('forHandle', ref.handle.startsWith('@') ? ref.handle : `@${ref.handle}`);

  const response = await fetchFn(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`YouTube channel lookup failed (${response.status})`);
  }
  const json = (await response.json()) as {
    items?: Array<{
      id: string;
      snippet?: { title?: string; customUrl?: string };
      statistics?: {
        subscriberCount?: string;
        viewCount?: string;
        videoCount?: string;
        hiddenSubscriberCount?: boolean;
      };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  };
  const item = json.items?.[0];
  if (!item) {
    throw new Error('No YouTube channel matched that URL or handle');
  }
  return {
    channelId: item.id,
    handle: item.snippet?.customUrl?.replace(/^@/, '') || (ref.kind === 'handle' ? ref.handle : ''),
    title: item.snippet?.title || 'YouTube',
    subscriberCount: item.statistics?.hiddenSubscriberCount
      ? 0
      : asCount(item.statistics?.subscriberCount),
    viewCount: asCount(item.statistics?.viewCount),
    videoCount: asCount(item.statistics?.videoCount),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
  };
}

export async function fetchYouTubeRecentVideos(
  apiKey: string,
  uploadsPlaylistId: string,
  fetchFn: FetchLike = fetch,
  limit = 6,
): Promise<YouTubeVideoStats[]> {
  const playlistParams = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(limit),
    key: apiKey,
  });
  const playlistResponse = await fetchFn(
    `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams.toString()}`,
  );
  if (!playlistResponse.ok) return [];
  const playlistJson = (await playlistResponse.json()) as {
    items?: Array<{
      snippet?: { title?: string; publishedAt?: string };
      contentDetails?: { videoId?: string };
    }>;
  };
  const items = playlistJson.items ?? [];
  const ids = items
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const videoParams = new URLSearchParams({
    part: 'statistics',
    id: ids.join(','),
    key: apiKey,
  });
  const videoResponse = await fetchFn(
    `https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`,
  );
  if (!videoResponse.ok) return [];
  const videoJson = (await videoResponse.json()) as {
    items?: Array<{
      id: string;
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
    }>;
  };
  const statsById = new Map(
    (videoJson.items ?? []).map((item) => [item.id, item.statistics]),
  );

  return items
    .map((item) => {
      const id = item.contentDetails?.videoId;
      if (!id) return null;
      const stats = statsById.get(id);
      const published = item.snippet?.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      return {
        title: item.snippet?.title || 'YouTube video',
        url: `https://www.youtube.com/watch?v=${id}`,
        postedAt: published,
        views: asCount(stats?.viewCount),
        likes: asCount(stats?.likeCount),
        comments: asCount(stats?.commentCount),
      };
    })
    .filter((row): row is YouTubeVideoStats => row !== null);
}
