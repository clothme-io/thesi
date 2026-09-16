export type YouTubeChannelRef =
  | { kind: 'id'; id: string }
  | { kind: 'handle'; handle: string };

export function parseYouTubeChannelRef(raw: string): YouTubeChannelRef | null {
  const value = raw.trim();
  if (!value) return null;

  const channelId = value.match(/(UC[\w-]{22})/);
  if (channelId?.[1]) return { kind: 'id', id: channelId[1] };

  const handleMatch =
    value.match(/youtube\.com\/@([^/?#]+)/i) ??
    value.match(/youtu\.be\/@([^/?#]+)/i) ??
    value.match(/^@([^/?#\s]+)$/);
  if (handleMatch?.[1]) {
    return { kind: 'handle', handle: decodeURIComponent(handleMatch[1]) };
  }

  const custom = value.match(/youtube\.com\/(?:c|user)\/([^/?#]+)/i);
  if (custom?.[1]) {
    return { kind: 'handle', handle: decodeURIComponent(custom[1]) };
  }

  if (/^[\w.-]{3,50}$/.test(value)) {
    return { kind: 'handle', handle: value.replace(/^@/, '') };
  }

  return null;
}

export function parseTikTokHandle(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const match =
    value.match(/tiktok\.com\/@([^/?#]+)/i) ?? value.match(/^@?([\w.]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export type SocialContentRef = {
  provider: 'youtube' | 'tiktok' | 'instagram';
  mediaId: string;
};

export function parseYouTubeVideoId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && !id.startsWith('@') ? id : null;
    }
    if (url.hostname.includes('youtube.com')) {
      const watch = url.searchParams.get('v');
      if (watch) return watch;
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
        return parts[1] || null;
      }
    }
  } catch {
    if (/^[\w-]{6,20}$/.test(value)) return value;
  }
  return null;
}

export function parseTikTokVideoId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const match = value.match(/tiktok\.com\/@[^/?#]+\/video\/(\d+)/i);
  return match?.[1] ?? null;
}

export function parseInstagramShortcode(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const match = value.match(
    /instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i,
  );
  return match?.[1] ?? null;
}

export function parseSocialContentUrl(raw: string): SocialContentRef | null {
  const youtube = parseYouTubeVideoId(raw);
  if (youtube) return { provider: 'youtube', mediaId: youtube };
  const tiktok = parseTikTokVideoId(raw);
  if (tiktok) return { provider: 'tiktok', mediaId: tiktok };
  const instagram = parseInstagramShortcode(raw);
  if (instagram) return { provider: 'instagram', mediaId: instagram };
  return null;
}

export function parseInstagramHandle(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const match =
    value.match(/instagram\.com\/([^/?#]+)/i) ?? value.match(/^@?([\w.]+)$/);
  const handle = match?.[1] ? decodeURIComponent(match[1]) : null;
  if (!handle) return null;
  if (['p', 'reel', 'reels', 'stories', 'explore'].includes(handle.toLowerCase())) {
    return null;
  }
  return handle;
}
