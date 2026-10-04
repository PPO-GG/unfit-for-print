import { describe, it, expect, vi } from "vitest";
import { shareInvite } from "~/utils/shareInvite";

const url = "https://unfit.cards/game/3046EP";

describe("shareInvite", () => {
  it("uses the native share sheet when available", async () => {
    const nav = { share: vi.fn(async () => {}), clipboard: { writeText: vi.fn(async () => {}) } };
    expect(await shareInvite(url, { title: "Join", inDiscord: false, nav })).toBe("shared");
    expect(nav.share).toHaveBeenCalledWith({ title: "Join", url });
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("treats a dismissed share sheet as cancelled, not as a failure", async () => {
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    const nav = { share: vi.fn(async () => { throw abort; }), clipboard: { writeText: vi.fn() } };
    expect(await shareInvite(url, { title: "Join", inDiscord: false, nav })).toBe("cancelled");
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard when share is missing or fails", async () => {
    const nav = { share: vi.fn(async () => { throw new Error("nope"); }), clipboard: { writeText: vi.fn(async () => {}) } };
    expect(await shareInvite(url, { title: "Join", inDiscord: false, nav })).toBe("copied");
    expect(await shareInvite(url, { title: "Join", inDiscord: false, nav: { clipboard: nav.clipboard } })).toBe("copied");
  });

  it("always copies inside the Discord Activity", async () => {
    const nav = { share: vi.fn(), clipboard: { writeText: vi.fn(async () => {}) } };
    expect(await shareInvite(url, { title: "Join", inDiscord: true, nav })).toBe("copied");
    expect(nav.share).not.toHaveBeenCalled();
  });

  it("reports failure when nothing works", async () => {
    const nav = { clipboard: { writeText: vi.fn(async () => { throw new Error("denied"); }) } };
    expect(await shareInvite(url, { title: "Join", inDiscord: false, nav })).toBe("failed");
    expect(await shareInvite(url, { title: "Join", inDiscord: false, nav: {} })).toBe("failed");
  });
});
