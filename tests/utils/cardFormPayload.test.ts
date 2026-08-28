import { describe, it, expect } from "vitest";
import { buildCardPayload } from "~/utils/cardFormPayload";

const baseAttachment = { offsetX: 0, offsetY: 0, scale: 1 };

describe("buildCardPayload", () => {
  it("builds a text-mode payload with image fields nulled out", () => {
    const payload = buildCardPayload({
      type: "white",
      pack: "Base",
      mode: "text",
      text: "  A funny answer.  ",
      imageFileId: "stale-key.webp",
      imageFormat: "webp",
      attachment: baseAttachment,
    });
    expect(payload).toEqual({
      type: "white",
      pack: "Base",
      text: "A funny answer.",
      imageFileId: null,
      imageFormat: null,
      attachment: null,
    });
  });

  it("builds an image-mode payload with text nulled out", () => {
    const payload = buildCardPayload({
      type: "white",
      pack: "Memes Vol 1",
      mode: "image",
      text: "stale text",
      imageFileId: "doge.webp",
      imageFormat: "webp",
      attachment: { offsetX: 0.1, offsetY: -0.2, scale: 1.5 },
    });
    expect(payload).toEqual({
      type: "white",
      pack: "Memes Vol 1",
      text: null,
      imageFileId: "doge.webp",
      imageFormat: "webp",
      attachment: { offsetX: 0.1, offsetY: -0.2, scale: 1.5 },
    });
  });

  it("includes pick only for black cards with a truthy pick value", () => {
    const white = buildCardPayload({
      type: "white",
      mode: "text",
      text: "x",
      pick: 3,
      imageFileId: null,
      imageFormat: null,
      attachment: baseAttachment,
    });
    expect(white).not.toHaveProperty("pick");

    const black = buildCardPayload({
      type: "black",
      mode: "text",
      text: "_ is chaos.",
      pick: 2,
      imageFileId: null,
      imageFormat: null,
      attachment: baseAttachment,
    });
    expect(black).toMatchObject({ pick: 2 });
  });
});
