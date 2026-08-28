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
