/**
 * Minimal .env parser. The Midscene CLI loads .env itself when spawning, but
 * the action needs to read it earlier:
 *  - to run model configuration preflight before installing anything;
 *  - to register secrets with core.setSecret (runner only masks values coming
 *    from the `secrets` context, not values loaded from a .env file).
 */
export function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([\w.]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    // Strip trailing inline comment only when the value is not quoted.
    if (!/^['"]/.test(value)) {
      value = value.replace(/\s+#.*$/, '');
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
