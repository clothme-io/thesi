/** Normalize API/DB date values to `YYYY-MM-DD` for `<input type="date">` and DTO validation. */
export function toDateInputValue(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}
