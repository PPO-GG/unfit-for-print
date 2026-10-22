import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// The layout owns the one back button (ScreenBackButton). A page that adds
// its own back link or breadcrumb row brings back the doubled controls.
const pagesDir = join(__dirname, "../../app/pages");

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return vueFiles(path);
    return name.endsWith(".vue") ? [path] : [];
  });
}

const pages = vueFiles(pagesDir).map((path) => ({
  page: relative(pagesDir, path).split(sep).join("/"),
  source: readFileSync(path, "utf8"),
}));

const FORBIDDEN = [
  "arrow-left-broken",
  "arrow-left-line-duotone",
  '"i-lucide-arrow-left"',
  "Back to home",
  "Back to Cards",
  ">Card Manager</NuxtLink",
  ">Admin</NuxtLink",
];

const TITLE_PAGES = [
  "about.vue",
  "changelog.vue",
  "legal/index.vue",
  "admin/index.vue",
  "admin/lobbies.vue",
  "admin/users.vue",
  "admin/feedback.vue",
  "admin/issues/index.vue",
  "admin/issues/[id].vue",
  "admin/decorations/index.vue",
  "admin/decorations/[id].vue",
  "admin/cards/upload.vue",
  "admin/cards/picks.vue",
  "admin/cards/duplicates.vue",
];

describe("one back control per screen", () => {
  it.each(pages.map((p) => [p.page, p.source]))(
    "%s has no back link of its own",
    (_page, source) => {
      for (const marker of FORBIDDEN) {
        expect(source.replace(/\s+>/g, ">"), marker).not.toContain(marker);
      }
    },
  );

  it.each(TITLE_PAGES)("%s uses ScreenTitle for its heading", (page) => {
    const source = pages.find((p) => p.page === page)?.source ?? "";

    expect(source).toContain("<ScreenTitle");
    expect(source).not.toMatch(/<h1[\s>]/);
  });
});
