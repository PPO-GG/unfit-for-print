import { describe, it, expect } from "vitest";
import {
  CHUNK_MAX_BYTES,
  splitArrayChunks,
  splitRecordChunks,
  readChunkedArray,
  readChunkedRecord,
} from "~/utils/chunkedDocValue";

const id = (n: number) =>
  `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const ids = (n: number) => Array.from({ length: n }, (_, i) => id(i));
const picks = (n: number) =>
  Object.fromEntries(ids(n).map((x) => [x, 1])) as Record<string, number>;

/** How a writer stores the chunks, so readers can be tested against it. */
const store = (key: string, chunks: string[]) => {
  const raw: Record<string, unknown> = { [`${key}Chunks`]: String(chunks.length) };
  chunks.forEach((c, i) => (raw[`${key}_${i}`] = c));
  return raw;
};

describe("splitArrayChunks", () => {
  it("keeps a small array in a single chunk", () => {
    const chunks = splitArrayChunks(ids(3));
    expect(chunks).toHaveLength(1);
    expect(JSON.parse(chunks[0]!)).toEqual(ids(3));
  });

  it("never emits a chunk over the byte budget", () => {
    // 1500 uuids is ~58KB — the all-packs blackPicks case that the websocket
    // write path drops as a single update.
    for (const c of splitArrayChunks(ids(1500))) {
      expect(Buffer.byteLength(c)).toBeLessThanOrEqual(CHUNK_MAX_BYTES);
    }
  });

  it("round-trips a large array exactly, order preserved", () => {
    const original = ids(1500);
    const back = readChunkedArray<string>(
      store("blackDeck", splitArrayChunks(original)),
      "blackDeck",
    );
    expect(back).toEqual(original);
  });

  it("emits one empty chunk for an empty array", () => {
    expect(splitArrayChunks([])).toEqual(["[]"]);
  });

  it("keeps an oversized single item rather than dropping it", () => {
    // A lone element bigger than the budget cannot be split further. Losing it
    // silently would be worse than an over-budget chunk.
    const big = "x".repeat(CHUNK_MAX_BYTES * 2);
    const back = readChunkedArray<string>(
      store("k", splitArrayChunks([big])),
      "k",
    );
    expect(back).toEqual([big]);
  });
});

describe("splitRecordChunks", () => {
  it("never emits a chunk over the byte budget", () => {
    for (const c of splitRecordChunks(picks(1500))) {
      expect(Buffer.byteLength(c)).toBeLessThanOrEqual(CHUNK_MAX_BYTES);
    }
  });

  it("round-trips a large record exactly", () => {
    const original = picks(1500);
    const back = readChunkedRecord<number>(
      store("blackPicks", splitRecordChunks(original)),
      "blackPicks",
    );
    expect(back).toEqual(original);
  });

  it("emits one empty chunk for an empty record", () => {
    expect(splitRecordChunks({})).toEqual(["{}"]);
  });
});

describe("readers", () => {
  // Documents created before chunking carry a single plain key. They must keep
  // working: a game in flight across a deploy still has to be joinable.
  it("falls back to the plain key when no chunk count is present", () => {
    expect(
      readChunkedArray<string>({ blackDeck: JSON.stringify(ids(2)) }, "blackDeck"),
    ).toEqual(ids(2));
    expect(
      readChunkedRecord<number>(
        { blackPicks: JSON.stringify(picks(2)) },
        "blackPicks",
      ),
    ).toEqual(picks(2));
  });

  it("prefers chunks over a stale plain key", () => {
    const raw = {
      ...store("blackDeck", splitArrayChunks(ids(3))),
      blackDeck: JSON.stringify(["stale"]),
    };
    expect(readChunkedArray<string>(raw, "blackDeck")).toEqual(ids(3));
  });

  it("returns empty for a missing key rather than throwing", () => {
    expect(readChunkedArray<string>({}, "nope")).toEqual([]);
    expect(readChunkedRecord<number>({}, "nope")).toEqual({});
  });

  it("survives a corrupt chunk without losing the others", () => {
    // 1500 ids spans several chunks; corrupting one must not discard the rest.
    const chunks = splitArrayChunks(ids(1500));
    expect(chunks.length).toBeGreaterThan(1);
    const raw = store("blackDeck", chunks);
    raw["blackDeck_0"] = "{not json";
    const back = readChunkedArray<string>(raw, "blackDeck");
    expect(back.length).toBeGreaterThan(0);
    expect(back.length).toBeLessThan(1500);
  });
});
