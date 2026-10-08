import {
  AUDIENCE_AGE_OPTIONS,
  AUDIENCE_GENDER_OPTIONS,
  LIFE_STAGE_OPTIONS,
  SHOPPER_STYLE_OPTIONS,
  VIDEO_FACE_OPTIONS,
  VIDEO_LENGTH_OPTIONS,
  VIDEO_SETTING_OPTIONS,
  VIDEO_STYLE_OPTIONS,
  WORK_OPTIONS,
  audienceSummary,
  videoSummary,
  type CampaignCreativeDirection,
  type CreativeDirectionFormState,
} from "@/lib/brand-campaigns/creative-direction";

function toggle(items: string[], value: string): string[] {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

function CheckGroup({
  legend,
  name,
  options,
  selected,
  onChange,
}: {
  legend: string;
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="workspace-field workspace-field--full" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend>{legend}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 8 }}>
        {options.map((option) => (
          <label key={option.value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              name={name}
              data-testid={`${name}-${option.value}`}
              checked={selected.includes(option.value)}
              onChange={() => onChange(toggle(selected, option.value))}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CreativeDirectionFields({
  value,
  onChange,
}: {
  value: CreativeDirectionFormState;
  onChange: (next: CreativeDirectionFormState) => void;
}) {
  const setAudience = (
    patch: Partial<CreativeDirectionFormState["audience"]>,
  ) => onChange({ ...value, audience: { ...value.audience, ...patch } });
  const setVideo = (patch: Partial<CreativeDirectionFormState["video"]>) =>
    onChange({ ...value, video: { ...value.video, ...patch } });

  return (
    <div className="workspace-field workspace-field--full" data-testid="creative-direction-fields">
      <h3 style={{ marginBottom: 4 }}>Who this video is for</h3>
      <p className="workspace-hint">
        Optional. Creators use this to picture the person in the video. You can save a draft or publish without it.
      </p>
      <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
        <CheckGroup
          legend="Age range"
          name="audience-age"
          options={AUDIENCE_AGE_OPTIONS}
          selected={value.audience.ageRanges}
          onChange={(ageRanges) => setAudience({ ageRanges })}
        />
        <CheckGroup
          legend="Gender"
          name="audience-gender"
          options={AUDIENCE_GENDER_OPTIONS}
          selected={value.audience.genders}
          onChange={(genders) => setAudience({ genders })}
        />
        <CheckGroup
          legend="Life stage"
          name="audience-life-stage"
          options={LIFE_STAGE_OPTIONS}
          selected={value.audience.lifeStages}
          onChange={(lifeStages) => setAudience({ lifeStages })}
        />
        <CheckGroup
          legend="Work"
          name="audience-work"
          options={WORK_OPTIONS}
          selected={value.audience.workRoles}
          onChange={(workRoles) => setAudience({ workRoles })}
        />
        <CheckGroup
          legend="Shopper"
          name="audience-shopper"
          options={SHOPPER_STYLE_OPTIONS}
          selected={value.audience.shopperStyles}
          onChange={(shopperStyles) => setAudience({ shopperStyles })}
        />
        <label className="workspace-field workspace-field--full">
          <span>Audience note</span>
          <textarea
            data-testid="audience-note"
            rows={2}
            maxLength={500}
            placeholder="Example: women getting ready for work who want outfits that look polished without feeling formal."
            value={value.audience.note}
            onChange={(event) => setAudience({ note: event.target.value })}
          />
        </label>
      </div>

      <h3 style={{ margin: "20px 0 4px" }}>How to make the video</h3>
      <p className="workspace-hint">
        Optional. Select every style that works. Creators can follow more than one.
      </p>
      <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
        <CheckGroup
          legend="Video styles"
          name="video-style"
          options={VIDEO_STYLE_OPTIONS}
          selected={value.video.styles}
          onChange={(styles) => setVideo({ styles })}
        />
        <label className="workspace-field">
          <span>Face</span>
          <select
            data-testid="video-face"
            value={value.video.face}
            onChange={(event) => setVideo({ face: event.target.value })}
          >
            {VIDEO_FACE_OPTIONS.map((option) => (
              <option key={option.value || "unspecified"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <CheckGroup
          legend="Setting"
          name="video-setting"
          options={VIDEO_SETTING_OPTIONS}
          selected={value.video.settings}
          onChange={(settings) => setVideo({ settings })}
        />
        <label className="workspace-field">
          <span>Length</span>
          <select
            data-testid="video-length"
            value={value.video.length}
            onChange={(event) => setVideo({ length: event.target.value })}
          >
            {VIDEO_LENGTH_OPTIONS.map((option) => (
              <option key={option.value || "unspecified"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="workspace-field workspace-field--full">
          <span>Must include</span>
          <textarea
            data-testid="video-must-include"
            rows={3}
            placeholder="One direction per line. Example: show the fit from the back."
            value={value.video.mustIncludeText}
            onChange={(event) => setVideo({ mustIncludeText: event.target.value })}
          />
        </label>
        <label className="workspace-field workspace-field--full">
          <span>Avoid</span>
          <textarea
            data-testid="video-avoid"
            rows={3}
            placeholder="One direction per line. Example: no heavy filters."
            value={value.video.avoidText}
            onChange={(event) => setVideo({ avoidText: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

export function CreativeDirectionSummary({
  value,
}: {
  value?: CampaignCreativeDirection | null;
}) {
  const audience = audienceSummary(value);
  const video = videoSummary(value);
  return (
    <>
      <h3 style={{ marginTop: 24 }}>Who this video is for</h3>
      {audience.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {audience.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p>Not specified.</p>
      )}
      <h3 style={{ marginTop: 24 }}>How to make the video</h3>
      {video.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {video.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p>Not specified.</p>
      )}
    </>
  );
}
