// @vitest-environment node
//
// How many avatars the compact top bar shows before a "+N" chip. Phones
// keep the fixed five; a tablet's bar fits as many as it has room for.

import { describe, expect, it } from "vitest";
import { visibleAvatarCount } from "~/utils/avatarCap";

describe("visibleAvatarCount", () => {
  it("keeps the phone's five when the bar is not fitted", () => {
    expect(visibleAvatarCount(7, null)).toBe(5);
    expect(visibleAvatarCount(3, null)).toBe(3);
  });

  // 320px / 32px = 10 slots.
  it("shows everyone who fits", () => {
    expect(visibleAvatarCount(8, 320)).toBe(8);
  });

  it("shows everyone, with no chip, when they fill the bar exactly", () => {
    expect(visibleAvatarCount(10, 320)).toBe(10);
  });

  it("keeps one slot for the chip when not everyone fits", () => {
    expect(visibleAvatarCount(12, 320)).toBe(9);
  });

  // useElementSize reports 0 until the first layout; that must not hide
  // everyone behind the chip.
  it("never drops below five, including before the bar is measured", () => {
    expect(visibleAvatarCount(7, 0)).toBe(5);
    expect(visibleAvatarCount(7, 100)).toBe(5);
  });
});
