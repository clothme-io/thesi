type FetchLike = typeof fetch;

export type TikTokToken = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  openId?: string;
  scope?: string;
};

export type TikTokUserStats = {
  openId: string;
  displayName: string;
  followerCount: number;
  likesCount: number;
  videoCount: number;
};

export type TikTokVideoStats = {
  title: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

function asCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function tiktokAuthorizeUrl(input: {
  clientKey: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_key: input.clientKey,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: 'user.info.basic,user.info.stats,video.list',
    state: input.state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeTikTokCode(
  input: {
    clientKey: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  },
  fetchFn: FetchLike = fetch,
): Promise<TikTokToken> {
  const response = await fetchFn('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: input.clientKey,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`TikTok token exchange failed (${response.status})`);
  }
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!json.access_token) {
    throw new Error(json.error_description || json.error || 'TikTok did not return a token');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    openId: json.open_id,
    scope: json.scope,
  };
}

export async function refreshTikTokToken(
  input: {
    clientKey: string;
    clientSecret: string;
    refreshToken: string;
  },
  fetchFn: FetchLike = fetch,
): Promise<TikTokToken> {
  const response = await fetchFn('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: input.clientKey,
      client_secret: input.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
    }),
  });
  if (!response.ok) {
    throw new Error(`TikTok token refresh failed (${response.status})`);
  }
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!json.access_token) {
    throw new Error(
      json.error_description || json.error || 'TikTok did not refresh the token',
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    openId: json.open_id,
    scope: json.scope,
  };
}

export async function fetchTikTokUserStats(
  accessToken: string,
  fetchFn: FetchLike = fetch,
): Promise<TikTokUserStats> {
  const params = new URLSearchParams({
    fields: 'open_id,display_name,follower_count,likes_count,video_count',
  });
  const response = await fetchFn(
    `https://open.tiktokapis.com/v2/user/info/?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`TikTok user lookup failed (${response.status})`);
  }
  const json = (await response.json()) as {
    data?: {
      user?: {
        open_id?: string;
        display_name?: string;
        follower_count?: number;
        likes_count?: number;
        video_count?: number;
      };
    };
    error?: { message?: string };
  };
  const user = json.data?.user;
  if (!user?.open_id) {
    throw new Error(json.error?.message || 'TikTok user info was empty');
  }
  return {
    openId: user.open_id,
    displayName: user.display_name || 'TikTok',
    followerCount: asCount(user.follower_count),
    likesCount: asCount(user.likes_count),
    videoCount: asCount(user.video_count),
  };
}

export async function fetchTikTokRecentVideos(
  accessToken: string,
  fetchFn: FetchLike = fetch,
  limit = 6,
): Promise<TikTokVideoStats[]> {
  const params = new URLSearchParams({
    fields: 'id,title,share_url,create_time,view_count,like_count,comment_count,share_count',
  });
  const response = await fetchFn(
    `https://open.tiktokapis.com/v2/video/list/?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: limit }),
    },
  );
  if (!response.ok) return [];
  const json = (await response.json()) as {
    data?: {
      videos?: Array<{
        id?: string;
        title?: string;
        share_url?: string;
        create_time?: number;
        view_count?: number;
        like_count?: number;
        comment_count?: number;
        share_count?: number;
      }>;
    };
  };
  return (json.data?.videos ?? []).map((video) => {
    const created = video.create_time
      ? new Date(video.create_time * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return {
      title: video.title || 'TikTok video',
      url: video.share_url || (video.id ? `https://www.tiktok.com/video/${video.id}` : ''),
      postedAt: created,
      views: asCount(video.view_count),
      likes: asCount(video.like_count),
      comments: asCount(video.comment_count),
      shares: asCount(video.share_count),
    };
  });
}
