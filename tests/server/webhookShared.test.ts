// @vitest-environment node

import { describe, expect, it } from "vitest";
import { stripMarkdown } from "~/server/utils/webhookShared";

describe("stripMarkdown", () => {
  it("removes backslashes so they cannot escape the surrounding markup", () => {
    expect(stripMarkdown("a\\b")).not.toContain("\\");
  });

  it("removes brackets, parens, backticks and emphasis characters", () => {
    expect(stripMarkdown("[x](y) `z` *a* _b_ ~c~ |d| <e>")).toBe("xy z a b c d e");
  });

  it("collapses whitespace and trims", () => {
    expect(stripMarkdown("  a \n\t b  ")).toBe("a b");
  });
});
