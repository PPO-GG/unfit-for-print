import { describe, it, expect, vi } from "vitest";
import { buildReadAloudText } from "~/utils/readAloud";

const black = "What ruined Friday night? _.";

describe("buildReadAloudText", () => {
  it("merges known texts without calling the resolver", async () => {
    const resolve = vi.fn();
    const text = await buildReadAloudText(
      black,
      ["w1"],
      { w1: { text: "Unsupervised brunch", pack: "core" } } as any,
      resolve,
    );
    expect(text).toBe("What ruined Friday night? Unsupervised brunch.");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("resolves only the missing ids", async () => {
    const resolve = vi.fn(async () => ({ w2: "Haunted Roombas" }));
    const text = await buildReadAloudText(
      "_ and _.",
      ["w1", "w2"],
      { w1: { text: "Brunch", pack: "core" } } as any,
      resolve,
    );
    expect(resolve).toHaveBeenCalledWith(["w2"]);
    expect(text).toBe("Brunch and Haunted Roombas.");
  });

  it("still returns the merge with blanks left empty when the resolver throws", async () => {
    const resolve = vi.fn(async () => {
      throw new Error("offline");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const text = await buildReadAloudText(black, ["w9"], {} as any, resolve);
    expect(text).toBe("What ruined Friday night? .");
    spy.mockRestore();
  });
});
