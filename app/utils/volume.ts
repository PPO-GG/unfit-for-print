export function normalizeVolumePercent(percent: number): number {
  if (Number.isNaN(percent)) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}
