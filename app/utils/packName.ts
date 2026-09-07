/**
 * Pack-name presentation for the admin Packs screen.
 *
 * 106 of the 111 real packs begin "Cards Against Humanity:". Rendered as one
 * truncated line, every tile showed the same 23 characters and cut off the
 * only part that identified the pack — "Cards Against Humanity: 2012…" next to
 * "Cards Against Humanity: 2013…". Splitting the shared series away lets the
 * distinguishing half take the headline.
 *
 * The prefix is derived from the data rather than hard-coded, so a future
 * series groups itself with no configuration.
 */

/** Below this share of the loaded packs, a prefix is not a series. */
const PREFIX_QUORUM = 0.6;

/**
 * The longest whole-word prefix shared by a clear majority of `names`.
 *
 * Deliberately not a strict longest-common-prefix over every name: the real
 * data has five packs that do not share it, and a strict version would return
 * "" and silently do nothing. A prefix only counts when most packs carry it.
 *
 * Returns "" when there is no majority prefix, when fewer than two names are
 * given, or when the "prefix" is the entire name (which would leave the
 * headline blank).
 */
export function commonPackPrefix(names: string[]): string {
  if (names.length < 2) return "";

  const quorum = Math.max(2, Math.ceil(names.length * PREFIX_QUORUM));

  // Candidate prefixes are word boundaries of the first name, longest first,
  // so the most specific series wins.
  const counts = new Map<string, number>();
  for (const name of names) {
    const words = name.split(" ");
    for (let i = 1; i < words.length; i++) {
      const candidate = words.slice(0, i).join(" ");
      counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
    }
  }

  let best = "";
  for (const [candidate, n] of counts) {
    if (n >= quorum && candidate.length > best.length) best = candidate;
  }
  return best;
}

/**
 * Split one pack name into its series prefix and the part that identifies it.
 *
 * Falls back to the whole name as the label whenever splitting would produce
 * an empty headline — a pack named exactly the prefix, or one that does not
 * carry it at all.
 */
export function splitPackName(
  name: string,
  prefix: string,
): { series: string; label: string } {
  if (!prefix || !name.startsWith(prefix)) return { series: "", label: name };

  // Drop the separator the split leaves behind (": ", " - ", plain space).
  const label = name.slice(prefix.length).replace(/^[\s:–—-]+/, "").trim();
  if (!label) return { series: "", label: name };

  return { series: prefix, label };
}

/**
 * A stable accent colour for a pack that has no `color` set.
 *
 * Every pack's `card_packs.color` is null today, so without this the whole
 * grid is one flat slate and the tiles are hard to tell apart at a glance.
 * Derived from the name, so a pack keeps its hue across reloads; a real
 * `color` always overrides it.
 */
export function packAccent(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360} 65% 60%)`;
}
