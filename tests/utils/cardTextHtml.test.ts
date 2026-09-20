import { describe, it, expect } from "vitest";
import { formatCardTextHtml } from "~/utils/cardTextHtml";

describe("formatCardTextHtml", () => {
  it("escapes markup so card text cannot inject nodes", () => {
    const html = formatCardTextHtml('<img src=x onerror="alert(1)">');

    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror=\"");
    expect(html).toContain("&lt;img");
  });

  it("still renders underscores as blank fill spans", () => {
    const html = formatCardTextHtml("Why did _ do that?");

    expect(html).toContain("<span style=");
    expect(html).toContain("border-bottom");
    expect(html).not.toContain("_");
  });

  it("escapes ampersands without mangling the blank spans", () => {
    const html = formatCardTextHtml("Tom & Jerry _");

    expect(html).toContain("Tom &amp; Jerry");
    // The generated span is markup we authored, so its quotes stay intact.
    expect(html).toContain('<span style="display:inline-block');
  });

  it("leaves a lone angle bracket readable rather than dropping it", () => {
    expect(formatCardTextHtml("I <3 this")).toContain("I &lt;3 this");
  });

  it("preserves the soft hyphens hyphenateCardText inserts", () => {
    expect(formatCardTextHtml("anti­bacterial")).toContain("anti­bacterial");
  });
});
