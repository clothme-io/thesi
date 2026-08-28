import {
  parseInstagramHandle,
  parseTikTokHandle,
  parseYouTubeChannelRef,
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
