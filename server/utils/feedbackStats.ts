export interface WeeklyPoint {
  weekStart: string;
  avgRating: number | null;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday of the UTC week containing `d`, as YYYY-MM-DD. Matches Postgres
 *  date_trunc('week', …) on a UTC session. */
function mondayKey(d: Date): string {
  const day = d.getUTCDay(); // 0 = Sunday
  const back = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - back * DAY_MS,
  );
  return monday.toISOString().slice(0, 10);
}

/** Pads the SQL weekly rollup so the chart shows quiet weeks as gaps rather
 *  than silently joining their neighbours. */
export function fillWeeklyGaps(
  rows: WeeklyPoint[],
  now: Date,
  weeks = 12,
): WeeklyPoint[] {
  const byWeek = new Map(rows.map((r) => [r.weekStart, r]));
  const thisMonday = new Date(`${mondayKey(now)}T00:00:00Z`).getTime();
  const out: WeeklyPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const key = new Date(thisMonday - i * 7 * DAY_MS).toISOString().slice(0, 10);
    out.push(byWeek.get(key) ?? { weekStart: key, avgRating: null, count: 0 });
  }
  return out;
}
