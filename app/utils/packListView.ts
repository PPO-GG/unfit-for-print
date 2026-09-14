import type { AdminPack } from "~/types/adminCard";

export type PackSort = "name" | "size" | "disabled";
export type PackChip = "all" | "default" | "official" | "nsfw" | "inactive";
export type PackListRow =
  | { kind: "group"; key: string; label: string; count: number }
  | { kind: "pack"; key: string; pack: AdminPack };

const NO_SERIES = "No series";

export const packTotal = (p: AdminPack) => p.white.total + p.black.total;
export const isPackDisabled = (p: AdminPack) => p.white.active + p.black.active === 0;

const byName = (a: AdminPack, b: AdminPack) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

function comparator(sort: PackSort) {
  if (sort === "size") return (a: AdminPack, b: AdminPack) => packTotal(b) - packTotal(a) || byName(a, b);
  if (sort === "disabled")
    return (a: AdminPack, b: AdminPack) =>
      Number(isPackDisabled(b)) - Number(isPackDisabled(a)) || byName(a, b);
  return byName;
}

function matchesChip(p: AdminPack, chip: PackChip) {
  switch (chip) {
    case "default":
      return p.isDefault;
    case "official":
      return p.official;
    case "nsfw":
      return p.nsfw;
    case "inactive":
      return isPackDisabled(p);
    default:
      return true;
  }
}

export function buildPackList(
  packs: AdminPack[],
  opts: { search: string; chip: PackChip; sort: PackSort; grouped: boolean },
): PackListRow[] {
  const term = opts.search.trim().toLowerCase();
  const visible = packs
    .filter((p) => matchesChip(p, opts.chip))
    .filter(
      (p) =>
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.series ?? "").toLowerCase().includes(term),
    )
    .sort(comparator(opts.sort));

  const packRow = (pack: AdminPack): PackListRow => ({ kind: "pack", key: pack.id, pack });
  if (!opts.grouped) return visible.map(packRow);

  const groups = new Map<string, AdminPack[]>();
  for (const p of visible) {
    const label = p.series?.trim() || NO_SERIES;
    groups.set(label, [...(groups.get(label) ?? []), p]);
  }
  const labels = [...groups.keys()].sort((a, b) => {
    if (a === NO_SERIES) return 1;
    if (b === NO_SERIES) return -1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });

  return labels.flatMap((label) => {
    const members = groups.get(label)!;
    return [
      { kind: "group" as const, key: `group:${label}`, label, count: members.length },
      ...members.map(packRow),
    ];
  });
}

export const packOrder = (rows: PackListRow[]) =>
  rows.flatMap((r) => (r.kind === "pack" ? [r.pack.id] : []));
