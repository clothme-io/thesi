import type { MarketplaceListing } from "./types";

export type RequirementRow = {
  label: string;
  value: string;
};

const KNOWN_PLATFORMS = [
  "tiktok",
  "instagram",
  "youtube",
  "twitter",
  "x",
  "facebook",
  "linkedin",
];

/** Build labeled requirement lines stored on marketplace listings. */
export function buildLabeledRequirements(input: {
  niches: string[];
  minFollowersRange: string;
  platforms: string[];
  location: string;
}): string[] {
  const rows: string[] = [];
  if (input.niches.length) {
    rows.push(`Niches: ${input.niches.join(", ")}`);
  }
  if (input.minFollowersRange.trim()) {
    rows.push(`Minimum followers: ${input.minFollowersRange.trim()}`);
  }
  if (input.platforms.length) {
    rows.push(`Platforms: ${input.platforms.join(", ")}`);
  }
  if (input.location.trim()) {
    rows.push(`Location: ${input.location.trim()}`);
  }
  return rows.length ? rows : ["See campaign brief for full creator criteria."];
}

/**
 * Turn stored requirement strings into labeled rows for the marketplace UI.
 * Supports new "Label: value" lines and older unlabeled seed/legacy data.
 */
export function toRequirementRows(requirements: string[]): RequirementRow[] {
  if (!requirements.length) {
    return [{ label: "Criteria", value: "See campaign brief" }];
  }

  const labeled: RequirementRow[] = [];
  const niches: string[] = [];
  const platforms: string[] = [];
  let followers = "";
  let location = "";
  let sawExplicitLabels = false;

  for (const raw of requirements) {
    const req = raw.trim();
    if (!req) continue;

    const labeledMatch = req.match(/^([^:]+):\s*(.+)$/);
    if (labeledMatch) {
      sawExplicitLabels = true;
      labeled.push({
        label: labeledMatch[1].trim(),
        value: labeledMatch[2].trim(),
      });
      continue;
    }

    if (/followers/i.test(req)) {
      followers = req.replace(/\s*followers\.?/i, "").trim() || req;
      continue;
    }

    if (
      KNOWN_PLATFORMS.some((platform) =>
        req.toLowerCase().includes(platform),
      ) &&
      req.split(/\s+/).length <= 3
    ) {
      platforms.push(req);
      continue;
    }

    // Short location-like tokens (US, CAD, Remote, US & CAD)
    if (/^(remote|worldwide|global|us|usa|uk|ca|cad|eu)(\s*[&+/].*)?$/i.test(req)) {
      location = location ? `${location}, ${req}` : req;
      continue;
    }

    niches.push(req);
  }

  if (sawExplicitLabels) return labeled;

  const rows: RequirementRow[] = [];
  if (niches.length) rows.push({ label: "Niches", value: niches.join(", ") });
  if (followers) {
    rows.push({ label: "Minimum followers", value: followers });
  }
  if (platforms.length) {
    rows.push({ label: "Platforms", value: platforms.join(", ") });
  }
  if (location) rows.push({ label: "Location", value: location });
  return rows.length
    ? rows
    : requirements.map((value) => ({ label: "Requirement", value }));
}

export function requirementRowsFromListing(
  listing: Pick<MarketplaceListing, "requirements" | "location" | "remoteOk">,
): RequirementRow[] {
  const rows = toRequirementRows(listing.requirements);
  const hasLocation = rows.some((row) =>
    row.label.toLowerCase().includes("location"),
  );
  if (!hasLocation && listing.location) {
    rows.push({
      label: "Location",
      value: listing.remoteOk
        ? `Remote OK · ${listing.location}`
        : listing.location,
    });
  }
  return rows;
}
