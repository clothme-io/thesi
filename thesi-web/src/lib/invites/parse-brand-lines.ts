export type ParsedBrandLine = { name: string; email: string };

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w+/;

/**
 * Parse pasted brand invites. One entry per line (or semicolon).
 * A comma on a line is name vs email, not a new entry — matching the
 * placeholder `Acme Co, billing@acme.com`.
 */
export function parseBrandLines(raw: string): ParsedBrandLine[] {
  const seen = new Set<string>();
  const entries: ParsedBrandLine[] = [];

  for (const line of raw.split(/[\n;]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const emailMatch = trimmed.match(EMAIL_RE);
    const email = emailMatch?.[0] ?? "";
    if (!email) continue;

    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const name =
      trimmed
        .replace(email, "")
        .replace(/[<>",]/g, " ")
        .replace(/\s+/g, " ")
        .trim() || email.split("@")[0] || email;

    entries.push({ name, email });
  }

  return entries;
}
