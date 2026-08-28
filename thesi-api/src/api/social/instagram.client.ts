type FetchLike = typeof fetch;

export type InstagramToken = {
  accessToken: string;
  userId?: string;
};

export type InstagramUserStats = {
  id: string;
  username: string;
  followersCount: number;
  mediaCount: number;
};

export type InstagramMediaStats = {
  title: string;
  url: string;
  postedAt: string;
  likes: number;
  comments: number;
};

function asCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function instagramAuthorizeUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_manage_insights',
    state: input.state,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeInstagramCode(
  input: {
    appId: string;
    appSecret: string;
    code: string;
    redirectUri: string;
  },
  fetchFn: FetchLike = fetch,
): Promise<InstagramToken> {
  const response = await fetchFn('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.appId,
      client_secret: input.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      code: input.code,
    }),
  });
  if (!response.ok) {
    throw new Error(`Instagram token exchange failed (${response.status})`);
  }
  const json = (await response.json()) as {
    access_token?: string;
    user_id?: string | number;
    error_message?: string;
  };
  if (!json.access_token) {
    throw new Error(json.error_message || 'Instagram did not return a token');
  }
  return {
    accessToken: json.access_token,
    userId: json.user_id ? String(json.user_id) : undefined,
  };
}

export async function exchangeInstagramLongLivedToken(
  input: { appSecret: string; accessToken: string },
  fetchFn: FetchLike = fetch,
): Promise<{ accessToken: string; expiresIn?: number }> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: input.appSecret,
    access_token: input.accessToken,
  });
  const response = await fetchFn(
    `https://graph.instagram.com/access_token?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`Instagram long-lived token exchange failed (${response.status})`);
  }
  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!json.access_token) {
    throw new Error(json.error?.message || 'Instagram did not return a long-lived token');
  }
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

export async function fetchInstagramUserStats(
  accessToken: string,
  fetchFn: FetchLike = fetch,
): Promise<InstagramUserStats> {
  const params = new URLSearchParams({
    fields: 'id,username,followers_count,media_count',
    access_token: accessToken,
  });
  const response = await fetchFn(
    `https://graph.instagram.com/v21.0/me?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`Instagram user lookup failed (${response.status})`);
  }
  const json = (await response.json()) as {
    id?: string;
    username?: string;
    followers_count?: number;
    media_count?: number;
    error?: { message?: string };
  };
  if (!json.id) {
    throw new Error(json.error?.message || 'Instagram user info was empty');
  }
  return {
    id: json.id,
    username: json.username || 'instagram',
    followersCount: asCount(json.followers_count),
    mediaCount: asCount(json.media_count),
  };
}

export async function fetchInstagramRecentMedia(
  accessToken: string,
  fetchFn: FetchLike = fetch,
  limit = 6,
): Promise<InstagramMediaStats[]> {
  const params = new URLSearchParams({
    fields: 'id,caption,permalink,timestamp,like_count,comments_count',
    limit: String(limit),
    access_token: accessToken,
  });
  const response = await fetchFn(
    `https://graph.instagram.com/v21.0/me/media?${params.toString()}`,
  );
  if (!response.ok) return [];
  const json = (await response.json()) as {
    data?: Array<{
      caption?: string;
      permalink?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
    }>;
  };
  return (json.data ?? []).map((item) => ({
    title: (item.caption || 'Instagram post').slice(0, 120),
    url: item.permalink || '',
    postedAt: item.timestamp?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    likes: asCount(item.like_count),
    comments: asCount(item.comments_count),
  }));
}
