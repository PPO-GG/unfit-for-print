import { describe, expect, it } from "vitest";
import { getBreadcrumbBackPath } from "~/composables/useBreadcrumbBack";

describe("getBreadcrumbBackPath", () => {
  it.each([
    ["/labs", "/"],
    ["/admin/users", "/admin"],
    ["/admin/cards/upload", "/admin/cards"],
  ])("returns the parent route for %s", (path, expectedPath) => {
    expect(getBreadcrumbBackPath(path)).toBe(expectedPath);
  });
});
