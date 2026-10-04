import { describe, it, expect } from "vitest";
import {
  isCompactViewport,
  viewportOrientation,
  COMPACT_MEDIA_QUERY,
} from "~/utils/compactViewport";

describe("isCompactViewport", () => {
  it.each([
    [375, 812, true], // portrait phone
    [844, 390, true], // landscape phone: wide but short
    [767, 1024, true], // just under the width threshold
    [768, 1024, false], // portrait tablet
    [1024, 768, false], // landscape tablet
    [1280, 499, true], // short desktop window
    [1280, 500, false],
    [1920, 1080, false],
  ])("%i×%i → %s", (w, h, expected) => {
    expect(isCompactViewport(w, h)).toBe(expected);
  });
});

describe("viewportOrientation", () => {
  it("is landscape only when strictly wider than tall", () => {
    expect(viewportOrientation(844, 390)).toBe("landscape");
    expect(viewportOrientation(375, 812)).toBe("portrait");
    expect(viewportOrientation(500, 500)).toBe("portrait");
  });
});

describe("COMPACT_MEDIA_QUERY", () => {
  it("matches the JS thresholds", () => {
    expect(COMPACT_MEDIA_QUERY).toBe(
      "(max-width: 767.98px), (max-height: 499.98px)",
    );
  });
});
