import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
const notify = vi.fn();
const confirm = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({ useNotifications: () => ({ notify }) }));
vi.mock("~/composables/useConfirm", () => ({ useConfirm: () => ({ confirm }) }));

import { useExplorerMutations } from "~/composables/useExplorerMutations";
import type { AdminCard, AdminPack } from "~/types/adminCard";

const pack = (id: string, over: Partial<AdminPack> = {}): AdminPack => ({
  id, name: `Pack ${id}`, series: null, description: null, icon: null, color: null, sortOrder: 0,
  official: false, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 3, active: 3 }, black: { total: 1, active: 1 }, ...over,
});
const card = (id: string, over: Partial<AdminCard> = {}): AdminCard => ({
  id, type: "white", text: id, packId: "p1", pack: "Pack p1", active: true, ...over,
});

const calls = () => fetchMock.mock.calls.map(([url, opts]) => [url, opts?.body]);

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({});
  notify.mockReset();
  confirm.mockReset().mockResolvedValue(true);
});

describe("savePack", () => {
  it("sends only the changed name, then default and active changes", async () => {
    const m = useExplorerMutations();
    const p = pack("p1");
    const draft = { ...m.packToDraft(p), name: "Renamed", description: "  ", isDefault: true, active: false };

    expect(await m.savePack(p, draft)).toBe(true);
    expect(calls()).toEqual([
      ["/api/admin/cards/pack-meta", { id: "p1", name: "Renamed", description: null, icon: null, color: null, series: null, sortOrder: 0, official: false, nsfw: false }],
      ["/api/admin/cards/toggle-default-pack", { packId: "p1", isDefault: true }],
      ["/api/admin/cards/toggle-pack", { packId: "p1", type: "all", active: false }],
    ]);
  });

  it("omits name when unchanged and skips untouched flags", async () => {
    const m = useExplorerMutations();
    const p = pack("p1");
    await m.savePack(p, { ...m.packToDraft(p), series: "CAH" });
    expect(calls()).toEqual([
      ["/api/admin/cards/pack-meta", { id: "p1", description: null, icon: null, color: null, series: "CAH", sortOrder: 0, official: false, nsfw: false }],
    ]);
  });

  it("does not toggle an empty pack whose Enabled switch was left alone", async () => {
    const m = useExplorerMutations();
    const p = pack("p1", { white: { total: 0, active: 0 }, black: { total: 0, active: 0 } });
    await m.savePack(p, { ...m.packToDraft(p), description: "new" });
    expect(calls().map(([url]) => url)).toEqual(["/api/admin/cards/pack-meta"]);
  });

  it("explains a name clash and fails", async () => {
    fetchMock.mockRejectedValueOnce({ statusCode: 409 });
    const m = useExplorerMutations();
    const p = pack("p1");
    expect(await m.savePack(p, { ...m.packToDraft(p), name: "Taken" })).toBe(false);
    expect(notify.mock.calls[0]![0].description).toContain('A pack named "Taken" already exists');
  });

  it("reports a partly-saved pack when a later toggle fails", async () => {
    fetchMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("down"));
    const m = useExplorerMutations();
    const p = pack("p1");
    expect(await m.savePack(p, { ...m.packToDraft(p), isDefault: true })).toBe(false);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]![0].title).toBe("Pack partly saved");
  });
});

describe("pack bulk", () => {
  it("merges sources into the target, excluding the target", async () => {
    const m = useExplorerMutations();
    await m.mergePacks([pack("a"), pack("b")], pack("b"));
    expect(calls()).toEqual([["/api/admin/cards/merge-packs", { sourceIds: ["a"], targetId: "b" }]]);
  });

  it("sets default only where it differs, series in one call", async () => {
    const m = useExplorerMutations();
    await m.setPacksDefault([pack("a", { isDefault: true }), pack("b")], true);
    await m.setPacksSeries([pack("a"), pack("b")], "CAH");
    expect(calls()).toEqual([
      ["/api/admin/cards/toggle-default-pack", { packId: "b", isDefault: true }],
      ["/api/admin/cards/pack-meta-bulk", { packs: ["a", "b"], series: "CAH" }],
    ]);
  });

  it("enables only fully disabled packs, so a partly enabled pack keeps its disabled cards", async () => {
    const m = useExplorerMutations();
    const off = pack("off", { white: { total: 3, active: 0 }, black: { total: 1, active: 0 } });
    const partly = pack("partly", { white: { total: 3, active: 2 }, black: { total: 1, active: 1 } });
    expect(await m.setPacksActive([off, partly], true)).toBe(true);
    expect(calls()).toEqual([["/api/admin/cards/toggle-pack", { packId: "off", type: "all", active: true }]]);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "1 pack enabled" }));
  });

  it("makes no request when no pack needs the change", async () => {
    const m = useExplorerMutations();
    const off = pack("off", { white: { total: 3, active: 0 }, black: { total: 1, active: 0 } });
    expect(await m.setPacksActive([off], false)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({ title: "Nothing to change" });
  });

  it("does nothing when a delete is not confirmed", async () => {
    confirm.mockResolvedValueOnce(false);
    const m = useExplorerMutations();
    expect(await m.deletePacks([pack("a")])).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(confirm.mock.calls[0]![0].message).toContain("4 cards");
  });

  it("treats a 404 delete as already gone and keeps going", async () => {
    fetchMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockResolvedValueOnce({});
    const m = useExplorerMutations();
    expect(await m.deletePacks([pack("a"), pack("b"), pack("c")])).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("counts a hard failure as not deleted and reports how many landed", async () => {
    fetchMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 500 });
    const m = useExplorerMutations();
    expect(await m.deletePacks([pack("a"), pack("b"), pack("c")])).toBe(false);
    expect(notify.mock.calls.at(-1)![0].description).toBe("Deleted 2 of 3 packs.");
  });

  it("writes the merge summary", () => {
    const m = useExplorerMutations();
    expect(m.mergeSummary([pack("a"), pack("b")], pack("b"))).toBe(
      '"Pack b" keeps its name, description and default status. 4 cards move from "Pack a". ' +
        "A game in progress that selected it stops drawing from it until the lobby restarts.",
    );
  });

  it("uses singular verb agreement for a single moved card", () => {
    const m = useExplorerMutations();
    const single = pack("a", { white: { total: 1, active: 1 }, black: { total: 0, active: 0 } });
    expect(m.mergeSummary([single], pack("b"))).toBe(
      '"Pack b" keeps its name, description and default status. 1 card moves from "Pack a". ' +
        "A game in progress that selected it stops drawing from it until the lobby restarts.",
    );
  });
});

describe("cards", () => {
  it("moves by type in chunks of 500 to an existing pack or a new name", async () => {
    const m = useExplorerMutations();
    const whites = Array.from({ length: 501 }, (_, i) => card(`w${i}`));
    await m.moveCards([...whites, card("b1", { type: "black" })], { packId: "p9" });
    await m.moveCards([card("w1")], { name: "Brand New" });

    const bodies = calls().map(([, body]) => body);
    expect(bodies[0]).toMatchObject({ type: "white", toPackId: "p9" });
    expect(bodies[0].from.ids).toHaveLength(500);
    expect(bodies[1].from.ids).toEqual(["w500"]);
    expect(bodies[2]).toEqual({ from: { ids: ["b1"] }, type: "black", toPackId: "p9" });
    expect(bodies[3]).toEqual({ from: { ids: ["w1"] }, type: "white", toPack: "Brand New" });
  });

  it("changes active and pick only where they differ", async () => {
    const m = useExplorerMutations();
    await m.setCardsActive([card("w1"), card("w2", { active: false }), card("b1", { type: "black" })], false);
    await m.setCardsPick([card("b1", { type: "black", pick: 2 }), card("b2", { type: "black", pick: 1 }), card("w1")], 2);
    expect(calls()).toEqual([
      ["/api/admin/cards/set-active", { ids: ["w1"], type: "white", active: false }],
      ["/api/admin/cards/set-active", { ids: ["b1"], type: "black", active: false }],
      ["/api/admin/cards/set-pick", { ids: ["b2"], pick: 2 }],
    ]);
  });

  it("passes image fields back on save so an image card keeps its image", async () => {
    const m = useExplorerMutations();
    await m.saveCard(card("b1", { type: "black", imageKey: "k", imageFormat: "png", attachment: null }), { text: "", pick: 2 });
    expect(calls()).toEqual([
      ["/api/admin/cards/edit", { id: "b1", type: "black", text: "", pick: 2, imageFileId: "k", imageFormat: "png", attachment: undefined }],
    ]);
  });

  it("stops deleting after five consecutive failures", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const m = useExplorerMutations();
    expect(await m.deleteCards(Array.from({ length: 8 }, (_, i) => card(`w${i}`)))).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
