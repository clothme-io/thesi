import {
  parseInstagramHandle,
  parseInstagramShortcode,
  parseSocialContentUrl,
  parseTikTokHandle,
  parseTikTokVideoId,
  parseYouTubeChannelRef,
  parseYouTubeVideoId,
} from './parse-social-handle';

describe('parseYouTubeChannelRef', () => {
  it('reads a channel id from a URL', () => {
    expect(
      parseYouTubeChannelRef(
        'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx',
      ),
    ).toEqual({ kind: 'id', id: 'UCxxxxxxxxxxxxxxxxxxxxxx' });
  });

  it('reads an @handle from a URL or bare handle', () => {
    expect(parseYouTubeChannelRef('https://youtube.com/@ava.chen')).toEqual({
      kind: 'handle',
      handle: 'ava.chen',
    });
    expect(parseYouTubeChannelRef('@ava')).toEqual({
      kind: 'handle',
      handle: 'ava',
    });
  });

  it('returns null for empty input', () => {
    expect(parseYouTubeChannelRef('')).toBeNull();
  });
});

describe('parseTikTokHandle', () => {
  it('reads a TikTok URL or @handle', () => {
    expect(parseTikTokHandle('https://www.tiktok.com/@ava.chen')).toBe('ava.chen');
    expect(parseTikTokHandle('@ava')).toBe('ava');
  });
});

describe('parseInstagramHandle', () => {
  it('reads an Instagram URL or @handle', () => {
    expect(parseInstagramHandle('https://instagram.com/ava.chen')).toBe('ava.chen');
    expect(parseInstagramHandle('@ava')).toBe('ava');
  });

  it('ignores Instagram content paths', () => {
    expect(parseInstagramHandle('https://instagram.com/reel/abc')).toBeNull();
  });
});

describe('parseSocialContentUrl', () => {
  it('reads a YouTube watch URL, short URL, and shorts URL', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(parseSocialContentUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual(
      { provider: 'youtube', mediaId: 'dQw4w9WgXcQ' },
    );
  });

  it('reads a TikTok video URL', () => {
    expect(
      parseTikTokVideoId('https://www.tiktok.com/@ava.chen/video/7123456789012345678'),
    ).toBe('7123456789012345678');
    expect(
      parseSocialContentUrl(
        'https://www.tiktok.com/@ava.chen/video/7123456789012345678',
      ),
    ).toEqual({ provider: 'tiktok', mediaId: '7123456789012345678' });
  });

  it('reads Instagram reel and post URLs', () => {
    expect(parseInstagramShortcode('https://www.instagram.com/reel/AbC_12-xy/')).toBe(
      'AbC_12-xy',
    );
    expect(parseSocialContentUrl('https://www.instagram.com/p/AbC_12-xy/')).toEqual({
      provider: 'instagram',
      mediaId: 'AbC_12-xy',
    });
  });

  it('returns null for non-content URLs', () => {
    expect(parseSocialContentUrl('https://instagram.com/ava.chen')).toBeNull();
    expect(parseSocialContentUrl('not a url')).toBeNull();
  });
});
