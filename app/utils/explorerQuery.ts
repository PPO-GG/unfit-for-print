/** The Explorer's URL state, so reloads and the back button keep the view. */
export type CardFilter = "all" | "white" | "black" | "inactive";
export type CardView = "table" | "grid";

export interface ExplorerQuery {
  packs: string[];
  type: CardFilter;
  q: string;
  card: string | null;
  view: CardView;
  /** `?pack=<name>` links from before pack ids; resolved to an id by the page. */
  legacyPack: string | null;
}

const FILTERS: CardFilter[] = ["all", "white", "black", "inactive"];
const VIEWS: CardView[] = ["table", "grid"];
const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? String(v[0] ?? "") : "");

export function parseExplorerQuery(q: Record<string, unknown>): ExplorerQuery {
  const type = str(q.type) as CardFilter;
  const view = str(q.view) as CardView;
  return {
    packs: str(q.packs).split(",").map((s) => s.trim()).filter(Boolean),
    type: FILTERS.includes(type) ? type : "all",
    q: str(q.q),
    card: str(q.card) || null,
    view: VIEWS.includes(view) ? view : "table",
    legacyPack: str(q.pack) || null,
  };
}

export function serializeExplorerQuery(
  e: Omit<ExplorerQuery, "legacyPack">,
): Record<string, string | undefined> {
  return {
    packs: e.packs.length ? e.packs.join(",") : undefined,
    type: e.type === "all" ? undefined : e.type,
    q: e.q || undefined,
    card: e.card ?? undefined,
    view: e.view === "table" ? undefined : e.view,
  };
}
