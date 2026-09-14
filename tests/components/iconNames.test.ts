// tests/components/iconNames.test.ts
//
// An icon name that is not in its collection fails silently: the icon API
// answers 204, Nuxt Icon has no data to build CSS from, and the span renders
// as a blank 0x0 box. `solar:loading-bold-duotone` shipped that way for every
// loading spinner — Solar has no loading icon at all. This checks each Solar
// and Lucide name referenced in the app against the installed collections.
//
// Other prefixes (mdi, heroicons, flag, simple-icons, svg-spinners) are not
// installed locally, so Nuxt Icon resolves them through the Iconify API and
// they cannot be checked offline.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "../..");
const COLLECTIONS = ["solar", "lucide"] as const;

function iconSet(prefix: string): Set<string> {
  const json = JSON.parse(
    readFileSync(
      join(ROOT, "node_modules/@iconify-json", prefix, "icons.json"),
      "utf8",
    ),
  );
  return new Set([
    ...Object.keys(json.icons),
    ...Object.keys(json.aliases ?? {}),
  ]);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(vue|ts)$/.test(entry.name) ? [full] : [];
  });
}

// `solar:name` (the <Icon> form) and `i-solar-name` (Nuxt UI icon props).
const REFERENCE = new RegExp(
  `\\b(?:i-(${COLLECTIONS.join("|")})-([a-z0-9-]+)|(${COLLECTIONS.join("|")}):([a-z0-9-]+))`,
  "g",
);

describe("icon names", () => {
  it("references only Solar and Lucide icons that exist", () => {
    const sets = Object.fromEntries(COLLECTIONS.map((p) => [p, iconSet(p)]));
    const files = [
      ...sourceFiles(join(ROOT, "app")),
      ...sourceFiles(join(ROOT, "shared")),
      join(ROOT, "nuxt.config.ts"),
    ];

    let checked = 0;
    const missing: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const match of line.matchAll(REFERENCE)) {
            const prefix = (match[1] ?? match[3])!;
            const name = (match[2] ?? match[4])!;
            checked++;
            if (!sets[prefix]!.has(name)) {
              missing.push(
                `${prefix}:${name} at ${relative(ROOT, file)}:${index + 1}`,
              );
            }
          }
        });
    }

    // Guards against the pattern silently matching nothing.
    expect(checked).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });
});
