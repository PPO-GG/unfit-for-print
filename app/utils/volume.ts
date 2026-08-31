export function normalizeVolumePercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}

export function clampVolumePercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function applyVolume(target: { volume: number }, percent: number): void {
  target.volume = normalizeVolumePercent(percent);
}
