/**
 * Brand-page status strip data (online count, season info, version).
 *
 * Currently returns static placeholder values matching the design
 * prototype. Wire up to real sources when available:
 *   - `onlineCount` → teleportal live-doc count
 *   - `season` → active season from a `seasons` Appwrite collection
 *   - `version` → already available via the __VERSION__ compile define
 */
export function useBrandStatus() {
  const onlineCount = ref<string>("1,284");
  const season = ref<string>('Season 03 · "Last Call"');
  const version = ref<string>(
    typeof __VERSION__ !== "undefined" ? `v${__VERSION__}` : "v4.2.0",
  );

  return { onlineCount, season, version };
}
