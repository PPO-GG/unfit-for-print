import { describe, expect, it } from "vitest";
import {
  getBreadcrumbBackLabelKey,
  getBreadcrumbBackPath,
  SCREEN_LABEL_KEYS,
  showsScreenBack,
} from "~/composables/useBreadcrumbBack";
import en from "../../i18n/locales/en.json";

describe("getBreadcrumbBackPath", () => {
  it.each([
    ["/labs", "/"],
    ["/admin/users", "/admin"],
    ["/admin/cards/upload", "/admin/cards"],
  ])("returns the parent route for %s", (path, expectedPath) => {
    expect(getBreadcrumbBackPath(path)).toBe(expectedPath);
  });
});

describe("showsScreenBack", () => {
  it.each([
    ["/", false],
    ["/game/ABCD", false],
    ["/game", true],
    ["/labs", true],
    ["/admin/cards/upload", true],
    ["/legal/privacypolicy", true],
  ])("%s -> %s", (path, shown) => {
    expect(showsScreenBack(path)).toBe(shown);
  });
});

describe("getBreadcrumbBackLabelKey", () => {
  it.each([
    ["/labs", "nav.home"],
    ["/game", "nav.home"],
    ["/about", "nav.home"],
    ["/legal", "nav.home"],
    ["/legal/privacypolicy", "nav.legal"],
    ["/legal/", "nav.home"],
    ["/admin", "nav.home"],
    ["/admin/users", "nav.admin"],
    ["/admin/cards/upload", "nav.admin_cards"],
    ["/admin/decorations/abc-123", "nav.admin_decorations"],
    ["/admin/issues/42", "nav.admin_issues"],
    ["/admin/cards/somethingnew/deeper", "nav.back"],
  ])("%s -> %s", (path, key) => {
    expect(getBreadcrumbBackLabelKey(path)).toBe(key);
  });

  it("has an English string for every label key", () => {
    const messages = en as Record<string, unknown>;
    const keys = [...Object.values(SCREEN_LABEL_KEYS), "nav.back"];

    expect(Object.keys(SCREEN_LABEL_KEYS)).toHaveLength(6);
    for (const key of keys) {
      expect(messages[key], key).toEqual(expect.any(String));
      expect((messages[key] as string).length, key).toBeGreaterThan(0);
    }
  });
});
