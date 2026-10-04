import { describe, it, expect } from "vitest";
import {
  BLANK_SPAN,
  formatCardTextHtml,
  formatFilledCardTextHtml,
} from "~/utils/cardTextHtml";

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

describe("formatFilledCardTextHtml", () => {
  it("puts each fill into the next run of underscores", () => {
    expect(formatFilledCardTextHtml("_ and ___.", ["Brunch", "Roombas"])).toBe(
      '<span class="card-fill">Brunch</span> and <span class="card-fill">Roombas</span>.',
    );
  });

  it("drops a fill's own ending punctuation when the prompt supplies it", () => {
    expect(
      formatFilledCardTextHtml("I like to think about _.", ["Shooting protestors."]),
    ).toBe('I like to think about <span class="card-fill">Shooting protestors</span>.');
    expect(formatFilledCardTextHtml("Get ready for _!", ["Roombas!"])).toBe(
      'Get ready for <span class="card-fill">Roombas</span>!',
    );
  });

  it("keeps a fill's punctuation when the blank is not followed by any", () => {
    expect(formatFilledCardTextHtml("_ is why I cry", ["Brunch."])).toBe(
      '<span class="card-fill">Brunch.</span> is why I cry',
    );
  });

  it("leaves unfilled blanks as the normal blank", () => {
    expect(formatFilledCardTextHtml("_ and _.", ["Brunch"])).toBe(
      `<span class="card-fill">Brunch</span> and ${BLANK_SPAN}.`,
    );
  });

  it("escapes both the prompt and the fill", () => {
    const html = formatFilledCardTextHtml("<b>_</b>", ['<img src=x onerror="alert(1)">']);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("appends fills after a prompt with no blanks", () => {
    expect(formatFilledCardTextHtml("Why am I sticky?", ["Brunch"])).toBe(
      'Why am I sticky? <span class="card-fill">Brunch</span>',
    );
  });

  it("joins several fills after a blank-less prompt and escapes them", () => {
    expect(
      formatFilledCardTextHtml("Why am I sticky?", ["Brunch", "", "<b>x</b>"]),
    ).toBe(
      'Why am I sticky? <span class="card-fill">Brunch</span>, <span class="card-fill">&lt;b&gt;x&lt;/b&gt;</span>',
    );
  });

  it("returns just the escaped prompt for a blank-less prompt with no fills", () => {
    expect(formatFilledCardTextHtml("Why <am> I sticky?", [])).toBe(
      "Why &lt;am&gt; I sticky?",
    );
  });
});
