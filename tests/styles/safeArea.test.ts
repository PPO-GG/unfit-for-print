import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Discord's mobile client draws its own header over the top of an Activity
// and reports the space it covers in --discord-safe-area-inset-*, not in
// env(safe-area-inset-*). A layout padded with env() alone slides under that
// header, and nothing but a phone inside Discord shows it.

const APP = join(__dirname, "../../app");
const TOKENS = "assets/css/main.css";

function sourceFiles(): string[] {
  return (readdirSync(APP, { recursive: true }) as string[])
    .filter((f) => /\.(vue|css|ts)$/.test(f))
    .map((f) => f.replace(/\\/g, "/"));
}

describe("safe-area insets", () => {
  it("defines one token per edge that prefers Discord's inset", () => {
    const css = readFileSync(join(APP, TOKENS), "utf8");
    for (const edge of ["top", "bottom", "left", "right"]) {
      expect(css).toContain(
        `--safe-${edge}: var(--discord-safe-area-inset-${edge}, env(safe-area-inset-${edge}, 0px));`,
      );
    }
  });

  it("pads through the tokens, never env() directly", () => {
    const offenders = sourceFiles()
      .filter((f) => f !== TOKENS)
      .filter((f) => {
        // Comments may still name env(); only declarations count.
        const code = readFileSync(join(APP, f), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        return code.includes("env(safe-area-inset-");
      });
    expect(offenders).toEqual([]);
  });
});
