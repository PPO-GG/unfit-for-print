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
  "Back to home",
  "Back to Cards",
  ">Card Manager</NuxtLink",
  ">Admin</NuxtLink",
];

// Any left-arrow icon on a page is a back control, except these in-page ones.
const ALLOWED_LEFT_ARROWS: Record<string, number> = {
  "admin/cards/duplicates.vue": 1, // "Prev" cluster button
};

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

function backLinkMarkers(source: string, allowedLeftArrows = 0): string[] {
  const flat = source.replace(/\s+>/g, ">");
  const found = FORBIDDEN.filter((marker) => flat.includes(marker));
  const leftArrows = flat.split("arrow-left").length - 1;
  if (leftArrows > allowedLeftArrows) found.push(`${leftArrows}× arrow-left icon`);
  return found;
}

describe("backLinkMarkers", () => {
  it.each([
    '<UButton to="/admin/cards" icon="i-solar-alt-arrow-left-linear">Cards</UButton>',
    '<UButton icon="i-solar-alt-arrow-left-bold-duotone" @click="back" />',
    '<NuxtLink to="/"><UIcon name="i-solar-arrow-left-line-duotone" /></NuxtLink>',
  ])("flags a re-added back control: %s", (source) => {
    expect(backLinkMarkers(source)).not.toEqual([]);
  });
});

describe("one back control per screen", () => {
  it.each(pages.map((p) => [p.page, p.source]))(
    "%s has no back link of its own",
    (page, source) => {
      expect(backLinkMarkers(source, ALLOWED_LEFT_ARROWS[page] ?? 0)).toEqual([]);
    },
  );

  it.each(TITLE_PAGES)("%s uses ScreenTitle for its heading", (page) => {
    const source = pages.find((p) => p.page === page)?.source ?? "";

    expect(source).toContain("<ScreenTitle");
    expect(source).not.toMatch(/<h1[\s>]/);
  });
});
