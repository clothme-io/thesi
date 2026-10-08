export const AUDIENCE_AGE_RANGES = [
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55+',
] as const;

export const AUDIENCE_GENDERS = ['women', 'men'] as const;

export const AUDIENCE_LIFE_STAGES = [
  'student',
  'young_professional',
  'parent',
  'expecting_parent',
  'partnered',
  'single',
] as const;

export const AUDIENCE_WORK_ROLES = [
  'student',
  'office',
  'healthcare',
  'trades',
  'stay_at_home_parent',
  'small_business_owner',
] as const;

export const SHOPPER_STYLES = ['budget', 'everyday', 'premium'] as const;

export const VIDEO_STYLES = [
  'talking_head',
  'green_screen',
  'voiceover_broll',
  'unboxing',
  'try_on',
  'get_ready_with_me',
  'day_in_the_life',
  'tutorial',
  'before_after',
  'product_demo',
  'testimonial',
  'skit_pov',
  'on_location',
  'screen_recording',
  'photo_set',
] as const;

export const VIDEO_FACE = ['on_camera', 'faceless_ok'] as const;

export const VIDEO_SETTINGS = [
  'at_home',
  'outdoors',
  'gym',
  'office',
  'store',
  'brand_choice',
] as const;

export const VIDEO_LENGTHS = [
  'under_15s',
  '15_30s',
  '30_60s',
  'longer',
] as const;

export type CampaignCreativeDirection = {
  audience: {
    ageRanges: string[];
    genders: string[];
    lifeStages: string[];
    workRoles: string[];
    shopperStyles: string[];
    note: string;
  };
  video: {
    styles: string[];
    face: string;
    settings: string[];
    length: string;
    mustInclude: string[];
    avoid: string[];
  };
};

export function emptyCreativeDirection(): CampaignCreativeDirection {
  return {
    audience: {
      ageRanges: [],
      genders: [],
      lifeStages: [],
      workRoles: [],
      shopperStyles: [],
      note: '',
    },
    video: {
      styles: [],
      face: '',
      settings: [],
      length: '',
      mustInclude: [],
      avoid: [],
    },
  };
}

export function normalizeCreativeDirection(
  value: unknown,
): CampaignCreativeDirection {
  const source = isRecord(value) ? value : {};
  const audience = isRecord(source.audience) ? source.audience : {};
  const video = isRecord(source.video) ? source.video : {};
  return {
    audience: {
      ageRanges: allowedList(audience.ageRanges, AUDIENCE_AGE_RANGES),
      genders: allowedList(audience.genders, AUDIENCE_GENDERS),
      lifeStages: allowedList(audience.lifeStages, AUDIENCE_LIFE_STAGES),
      workRoles: allowedList(audience.workRoles, AUDIENCE_WORK_ROLES),
      shopperStyles: allowedList(audience.shopperStyles, SHOPPER_STYLES),
      note: cleanText(audience.note, 500),
    },
    video: {
      styles: allowedList(video.styles, VIDEO_STYLES),
      face: allowedValue(video.face, VIDEO_FACE),
      settings: allowedList(video.settings, VIDEO_SETTINGS),
      length: allowedValue(video.length, VIDEO_LENGTHS),
      mustInclude: textList(video.mustInclude),
      avoid: textList(video.avoid),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function allowedList(
  value: unknown,
  allowed: readonly string[],
): string[] {
  if (!Array.isArray(value)) return [];
  const picked = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && allowed.includes(item)) picked.add(item);
  }
  return [...picked];
}

function allowedValue(value: unknown, allowed: readonly string[]): string {
  return typeof value === 'string' && allowed.includes(value) ? value : '';
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const lines: string[] = [];
  for (const item of value) {
    const text = cleanText(item, 160);
    if (text && !lines.includes(text) && lines.length < 20) lines.push(text);
  }
  return lines;
}
