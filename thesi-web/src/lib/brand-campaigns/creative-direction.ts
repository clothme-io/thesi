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

export type CreativeDirectionFormState = {
  audience: CampaignCreativeDirection["audience"];
  video: {
    styles: string[];
    face: string;
    settings: string[];
    length: string;
    mustIncludeText: string;
    avoidText: string;
  };
};

export const AUDIENCE_AGE_OPTIONS = [
  { value: "18-24", label: "18–24" },
  { value: "25-34", label: "25–34" },
  { value: "35-44", label: "35–44" },
  { value: "45-54", label: "45–54" },
  { value: "55+", label: "55+" },
] as const;

export const AUDIENCE_GENDER_OPTIONS = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
] as const;

export const LIFE_STAGE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "young_professional", label: "Young professional" },
  { value: "parent", label: "Parent" },
  { value: "expecting_parent", label: "Expecting parent" },
  { value: "partnered", label: "Partnered" },
  { value: "single", label: "Single" },
] as const;

export const WORK_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "office", label: "Office" },
  { value: "healthcare", label: "Healthcare" },
  { value: "trades", label: "Trades" },
  { value: "stay_at_home_parent", label: "Stay-at-home parent" },
  { value: "small_business_owner", label: "Small business owner" },
] as const;

export const SHOPPER_STYLE_OPTIONS = [
  { value: "budget", label: "Budget" },
  { value: "everyday", label: "Everyday" },
  { value: "premium", label: "Premium" },
] as const;

export const VIDEO_STYLE_OPTIONS = [
  { value: "talking_head", label: "Talking head" },
  { value: "green_screen", label: "Green screen" },
  { value: "voiceover_broll", label: "Voiceover with b-roll" },
  { value: "unboxing", label: "Unboxing" },
  { value: "try_on", label: "Try-on or haul" },
  { value: "get_ready_with_me", label: "Get ready with me" },
  { value: "day_in_the_life", label: "Day in the life" },
  { value: "tutorial", label: "Tutorial" },
  { value: "before_after", label: "Before and after" },
  { value: "product_demo", label: "Product demo" },
  { value: "testimonial", label: "Testimonial" },
  { value: "skit_pov", label: "Skit or point of view" },
  { value: "on_location", label: "On location" },
  { value: "screen_recording", label: "Screen recording" },
  { value: "photo_set", label: "Photo set" },
] as const;

export const VIDEO_FACE_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "on_camera", label: "On camera" },
  { value: "faceless_ok", label: "Faceless is fine" },
] as const;

export const VIDEO_SETTING_OPTIONS = [
  { value: "at_home", label: "At home" },
  { value: "outdoors", label: "Outdoors" },
  { value: "gym", label: "Gym" },
  { value: "office", label: "Office" },
  { value: "store", label: "Store" },
  { value: "brand_choice", label: "Brand's choice" },
] as const;

export const VIDEO_LENGTH_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "under_15s", label: "Under 15 seconds" },
  { value: "15_30s", label: "15–30 seconds" },
  { value: "30_60s", label: "30–60 seconds" },
  { value: "longer", label: "Longer" },
] as const;

export function emptyCreativeDirection(): CampaignCreativeDirection {
  return {
    audience: {
      ageRanges: [],
      genders: [],
      lifeStages: [],
      workRoles: [],
      shopperStyles: [],
      note: "",
    },
    video: {
      styles: [],
      face: "",
      settings: [],
      length: "",
      mustInclude: [],
      avoid: [],
    },
  };
}

export function creativeDirectionFormFrom(
  value?: CampaignCreativeDirection | null,
): CreativeDirectionFormState {
  const direction = value ?? emptyCreativeDirection();
  return {
    audience: {
      ageRanges: [...direction.audience.ageRanges],
      genders: [...direction.audience.genders],
      lifeStages: [...direction.audience.lifeStages],
      workRoles: [...direction.audience.workRoles],
      shopperStyles: [...direction.audience.shopperStyles],
      note: direction.audience.note ?? "",
    },
    video: {
      styles: [...direction.video.styles],
      face: direction.video.face ?? "",
      settings: [...direction.video.settings],
      length: direction.video.length ?? "",
      mustIncludeText: direction.video.mustInclude.join("\n"),
      avoidText: direction.video.avoid.join("\n"),
    },
  };
}

export function creativeDirectionFromForm(
  form: CreativeDirectionFormState,
): CampaignCreativeDirection {
  return {
    audience: {
      ...form.audience,
      note: form.audience.note.trim(),
    },
    video: {
      styles: form.video.styles,
      face: form.video.face,
      settings: form.video.settings,
      length: form.video.length,
      mustInclude: linesFromText(form.video.mustIncludeText),
      avoid: linesFromText(form.video.avoidText),
    },
  };
}

export function hasCreativeDirection(
  value?: CampaignCreativeDirection | null,
): boolean {
  if (!value) return false;
  const { audience, video } = value;
  return (
    audience.ageRanges.length > 0 ||
    audience.genders.length > 0 ||
    audience.lifeStages.length > 0 ||
    audience.workRoles.length > 0 ||
    audience.shopperStyles.length > 0 ||
    Boolean(audience.note.trim()) ||
    video.styles.length > 0 ||
    Boolean(video.face) ||
    video.settings.length > 0 ||
    Boolean(video.length) ||
    video.mustInclude.length > 0 ||
    video.avoid.length > 0
  );
}

function linesFromText(value: string): string[] {
  const lines: string[] = [];
  for (const line of value.split("\n")) {
    const text = line.trim();
    if (text && !lines.includes(text) && lines.length < 20) lines.push(text);
  }
  return lines;
}

function labelsFor(
  values: string[],
  options: ReadonlyArray<{ value: string; label: string }>,
): string[] {
  return values.map(
    (value) => options.find((option) => option.value === value)?.label ?? value,
  );
}

export function audienceSummary(value?: CampaignCreativeDirection | null): string[] {
  if (!value) return [];
  const { audience } = value;
  const lines: string[] = [];
  const ages = labelsFor(audience.ageRanges, AUDIENCE_AGE_OPTIONS);
  const genders = labelsFor(audience.genders, AUDIENCE_GENDER_OPTIONS);
  const stages = labelsFor(audience.lifeStages, LIFE_STAGE_OPTIONS);
  const work = labelsFor(audience.workRoles, WORK_OPTIONS);
  const shoppers = labelsFor(audience.shopperStyles, SHOPPER_STYLE_OPTIONS);
  if (ages.length) lines.push(`Age: ${ages.join(", ")}`);
  if (genders.length) lines.push(`Gender: ${genders.join(", ")}`);
  if (stages.length) lines.push(`Life stage: ${stages.join(", ")}`);
  if (work.length) lines.push(`Work: ${work.join(", ")}`);
  if (shoppers.length) lines.push(`Shopper: ${shoppers.join(", ")}`);
  if (audience.note.trim()) lines.push(audience.note.trim());
  return lines;
}

export function videoSummary(value?: CampaignCreativeDirection | null): string[] {
  if (!value) return [];
  const { video } = value;
  const lines: string[] = [];
  const styles = labelsFor(video.styles, VIDEO_STYLE_OPTIONS);
  const settings = labelsFor(video.settings, VIDEO_SETTING_OPTIONS);
  const face = VIDEO_FACE_OPTIONS.find((option) => option.value === video.face)?.label;
  const length = VIDEO_LENGTH_OPTIONS.find((option) => option.value === video.length)?.label;
  if (styles.length) lines.push(`Styles: ${styles.join(", ")}`);
  if (face && video.face) lines.push(`Face: ${face}`);
  if (settings.length) lines.push(`Setting: ${settings.join(", ")}`);
  if (length && video.length) lines.push(`Length: ${length}`);
  if (video.mustInclude.length) lines.push(`Include: ${video.mustInclude.join("; ")}`);
  if (video.avoid.length) lines.push(`Avoid: ${video.avoid.join("; ")}`);
  return lines;
}
