import type { YouTubeChannelRef } from './parse-social-handle';

export type YouTubeAuth = { accessToken: string } | { apiKey: string };

export type YouTubeToken = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
};

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
  id: string;
  title: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  channelId?: string;
};

type FetchLike = typeof fetch;

function asCount(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function authOf(auth: YouTubeAuth | string): YouTubeAuth {
  return typeof auth === 'string' ? { apiKey: auth } : auth;
}

async function youtubeGet(
  path: string,
  params: URLSearchParams,
  auth: YouTubeAuth,
  fetchFn: FetchLike,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if ('accessToken' in auth) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  } else {
    params.set('key', auth.apiKey);
  }
  return fetchFn(
    `https://www.googleapis.com/youtube/v3/${path}?${params.toString()}`,
    { headers },
  );
}

export function youtubeAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleToken(
  body: URLSearchParams,
  fetchFn: FetchLike,
): Promise<YouTubeToken> {
  const response = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`YouTube token exchange failed (${response.status})`);
  }
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!json.access_token) {
    throw new Error(
      json.error_description || json.error || 'YouTube did not return a token',
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  };
}

export async function exchangeYouTubeCode(
  input: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  },
  fetchFn: FetchLike = fetch,
): Promise<YouTubeToken> {
  return exchangeGoogleToken(
    new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    }),
    fetchFn,
  );
}

export async function refreshYouTubeToken(
  input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  },
  fetchFn: FetchLike = fetch,
): Promise<YouTubeToken> {
  return exchangeGoogleToken(
    new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
      grant_type: 'refresh_token',
    }),
    fetchFn,
  );
}

export async function fetchYouTubeChannelStats(
  auth: YouTubeAuth | string,
  ref: YouTubeChannelRef,
  fetchFn: FetchLike = fetch,
): Promise<YouTubeChannelStats> {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
  });
  if (ref.kind === 'id') params.set('id', ref.id);
  else
    params.set(
      'forHandle',
      ref.handle.startsWith('@') ? ref.handle : `@${ref.handle}`,
    );
  return mapChannel(
    await youtubeGet('channels', params, authOf(auth), fetchFn),
    ref,
  );
}

export async function fetchYouTubeMineChannel(
  accessToken: string,
  fetchFn: FetchLike = fetch,
): Promise<YouTubeChannelStats> {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    mine: 'true',
  });
  return mapChannel(
    await youtubeGet('channels', params, { accessToken }, fetchFn),
    { kind: 'handle', handle: '' },
  );
}

async function mapChannel(
  response: Response,
  ref: YouTubeChannelRef,
): Promise<YouTubeChannelStats> {
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
    handle:
      item.snippet?.customUrl?.replace(/^@/, '') ||
      (ref.kind === 'handle' ? ref.handle : ''),
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
  auth: YouTubeAuth | string,
  uploadsPlaylistId: string,
  fetchFn: FetchLike = fetch,
  limit = 6,
): Promise<YouTubeVideoStats[]> {
  const resolved = authOf(auth);
  const playlistParams = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(limit),
  });
  const playlistResponse = await youtubeGet(
    'playlistItems',
    playlistParams,
    resolved,
    fetchFn,
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
  const videos = await fetchYouTubeVideosByIds(resolved, ids, fetchFn);
  const byId = new Map(videos.map((video) => [video.id, video]));
  return items.flatMap((item) => {
    const id = item.contentDetails?.videoId;
    if (!id) return [];
    const stats = byId.get(id);
    const published =
      item.snippet?.publishedAt?.slice(0, 10) ??
      stats?.postedAt ??
      new Date().toISOString().slice(0, 10);
    const row: YouTubeVideoStats = {
      id,
      title: item.snippet?.title || stats?.title || 'YouTube video',
      url: `https://www.youtube.com/watch?v=${id}`,
      postedAt: published,
      views: stats?.views ?? 0,
      likes: stats?.likes ?? 0,
      comments: stats?.comments ?? 0,
      channelId: stats?.channelId,
    };
    return [row];
  });
}

export async function fetchYouTubeVideosByIds(
  auth: YouTubeAuth | string,
  ids: string[],
  fetchFn: FetchLike = fetch,
): Promise<YouTubeVideoStats[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    id: ids.join(','),
  });
  const response = await youtubeGet('videos', params, authOf(auth), fetchFn);
  if (!response.ok) return [];
  const json = (await response.json()) as {
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        publishedAt?: string;
        channelId?: string;
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
    }>;
  };
  return (json.items ?? []).map((item) => ({
    id: item.id,
    title: item.snippet?.title || 'YouTube video',
    url: `https://www.youtube.com/watch?v=${item.id}`,
    postedAt:
      item.snippet?.publishedAt?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
    views: asCount(item.statistics?.viewCount),
    likes: asCount(item.statistics?.likeCount),
    comments: asCount(item.statistics?.commentCount),
    channelId: item.snippet?.channelId,
  }));
}
