export type ParsedFromAddress = {
  email: string;
  name?: string;
};

export function parseFromAddress(from: string): ParsedFromAddress {
  const trimmed = from.trim();
  const angled = trimmed.match(/^(.*)<([^>]+)>\s*$/);
  if (!angled) {
    return { email: trimmed };
  }

  const name = angled[1].replace(/^["']|["']$/g, '').trim();
  const email = angled[2].trim();
  return name ? { email, name } : { email };
}
