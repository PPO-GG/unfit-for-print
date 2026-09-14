import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { packActions, cardActions, useExplorerActions } from "~/composables/useExplorerActions";
import type { AdminCard, AdminPack } from "~/types/adminCard";

const pack = (id: string, over: Partial<AdminPack> = {}): AdminPack => ({
  id, name: id, series: null, description: null, icon: null, color: null, sortOrder: 0,
  official: false, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 2, active: 2 }, black: { total: 0, active: 0 }, ...over,
});
const card = (id: string, over: Partial<AdminCard> = {}): AdminCard => ({
  id, type: "white", text: id, packId: "p", pack: "P", active: true, ...over,
});
const byId = <T extends { id: string }>(list: T[], id: string) => list.find((a) => a.id === id)!;

describe("packActions", () => {
  it("enables rename for exactly one pack", () => {
    expect(byId(packActions([pack("a")]), "rename").enabled).toBe(true);
    expect(byId(packActions([pack("a"), pack("b")]), "rename").enabled).toBe(false);
    expect(byId(packActions([]), "merge").enabled).toBe(false);
  });

  it("offers enable only when something is disabled, and vice versa", () => {
    const off = pack("off", { white: { total: 2, active: 0 } });
    expect(byId(packActions([pack("a")]), "enable-packs").enabled).toBe(false);
    expect(byId(packActions([pack("a")]), "disable-packs").enabled).toBe(true);
    expect(byId(packActions([off]), "enable-packs").enabled).toBe(true);
    expect(byId(packActions([off]), "disable-packs").enabled).toBe(false);
  });

  it("labels default toggling and delete from the selection", () => {
    expect(byId(packActions([pack("a", { isDefault: true })]), "toggle-default").label).toBe("Unset default");
    expect(byId(packActions([pack("a", { isDefault: true }), pack("b")]), "toggle-default").label).toBe("Set as default");
    expect(byId(packActions([pack("a"), pack("b")]), "delete-packs").label).toBe("Delete 2 packs…");
  });
});

describe("cardActions", () => {
  it("copies text only for one text card", () => {
    expect(byId(cardActions([card("a")]), "copy-text").enabled).toBe(true);
    expect(byId(cardActions([card("a", { text: null })]), "copy-text").enabled).toBe(false);
    expect(byId(cardActions([card("a"), card("b")]), "copy-text").enabled).toBe(false);
  });

  it("labels delete with the count", () => {
    expect(byId(cardActions([card("a")]), "delete-cards").label).toBe("Delete 1 card…");
  });
});

describe("useExplorerActions", () => {
  const setup = (focus: "pack" | "card") => {
    const run = vi.fn();
    const selectAll = vi.fn();
    const clear = vi.fn();
    const api = useExplorerActions({
      packs: ref([pack("a")]),
      cards: ref<AdminCard[]>([]),
      focus: ref(focus),
      run,
      selectAll,
      clear,
    });
    return { api, run, selectAll, clear };
  };

  it("builds menus with delete in its own group and disabled flags", () => {
    const { api, run } = setup("pack");
    const [main, danger] = api.packMenu.value;
    expect(danger!.map((i) => i.label)).toEqual(["Delete 1 pack…"]);
    expect(main!.find((i) => i.label === "Rename…")?.disabled).toBe(false);
    main!.find((i) => i.label === "Rename…")!.onSelect!(new Event("select"));
    expect(run).toHaveBeenCalledWith("rename");
    expect(api.cardMenu.value[1]![0]!.disabled).toBe(true);
  });

  it("routes shortcuts by focus and skips disabled actions", () => {
    const pk = setup("pack");
    pk.api.shortcuts.value.delete!();
    pk.api.shortcuts.value.f2!();
    pk.api.shortcuts.value.escape!();
    pk.api.shortcuts.value.meta_a!();
    expect(pk.run.mock.calls).toEqual([["delete-packs"], ["rename"]]);
    expect(pk.clear).toHaveBeenCalledWith("pack");
    expect(pk.selectAll).toHaveBeenCalledWith("pack");

    const cd = setup("card");
    cd.api.shortcuts.value.delete!(); // no cards selected → disabled → no-op
    expect(cd.run).not.toHaveBeenCalled();
  });

  it("keeps single-item actions out of the bars", () => {
    const { api } = setup("pack");
    expect(api.packBar.value.map((a) => a.id)).not.toContain("rename");
  });
});
