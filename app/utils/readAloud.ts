import type { CardTexts } from "~/types/gamecards";
import { mergeCardText } from "~/composables/useMergeCards";

/** Looks up white-card texts by id. Injected so tests never hit the network. */
export type ResolveTexts = (ids: string[]) => Promise<Record<string, string>>;

/**
 * The full joke for a submission — the black card with the white texts in its
 * blanks — as the judge's read-aloud broadcasts it.
 *
 * Submitted cards are not always in this client's `cardTexts` (each client
 * only resolves the cards it displays), so missing ids are fetched first. A
 * failed fetch still reads the prompt rather than nothing.
 */
export async function buildReadAloudText(
  blackText: string,
  submission: string[],
  cardTexts: CardTexts,
  resolve: ResolveTexts,
): Promise<string> {
  const missing = submission.filter((id) => !cardTexts[id]?.text);
  let resolved: Record<string, string> = {};
  if (missing.length > 0) {
    try {
      resolved = await resolve(missing);
    } catch (err) {
      console.error("[ReadAloud] Failed to resolve card texts:", err);
    }
  }
  const whites = submission.map(
    (id) => cardTexts[id]?.text ?? resolved[id] ?? "",
  );
  return mergeCardText(blackText, whites);
}

export const resolveWhiteTextsViaApi: ResolveTexts = async (ids) => {
  const rows = await $fetch<{ id: string; text: string }[]>(
    "/api/cards/resolve",
    { method: "POST", body: { ids } },
  );
  return Object.fromEntries(rows.map((row) => [row.id, row.text]));
};
