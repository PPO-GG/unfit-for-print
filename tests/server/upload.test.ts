import { describe, it, expect } from "vitest";
import {
  detectImageFormat,
  isValidLottieJson,
  isValidDotLottie,
} from "~/server/api/admin/decorations/upload.post";

describe("detectImageFormat", () => {
  it("detects PNG", () => {
    expect(detectImageFormat("image/png", "hat.png")).toBe("png");
  });

  it("detects WebP", () => {
    expect(detectImageFormat("image/webp", "hat.webp")).toBe("webp");
  });

  it("detects Lottie JSON", () => {
    expect(detectImageFormat("application/json", "anim.json")).toBe("lottie");
  });

  it("detects dotLottie from application/zip", () => {
    expect(detectImageFormat("application/zip", "anim.lottie")).toBe("dotlottie");
  });

  it("detects dotLottie from application/octet-stream", () => {
    expect(detectImageFormat("application/octet-stream", "anim.lottie")).toBe("dotlottie");
  });

  it("detects dotLottie from application/x-zip-compressed", () => {
    expect(detectImageFormat("application/x-zip-compressed", "anim.lottie")).toBe("dotlottie");
  });

  it("rejects octet-stream without .lottie extension", () => {
    expect(detectImageFormat("application/octet-stream", "file.bin")).toBeNull();
  });

  it("rejects unknown MIME type", () => {
    expect(detectImageFormat("text/html", "page.html")).toBeNull();
  });
});

describe("isValidLottieJson", () => {
  it("accepts valid Lottie JSON", () => {
    const valid = Buffer.from(
      JSON.stringify({ v: "5.7.1", fr: 30, w: 512, h: 512, layers: [{ ty: 4 }] }),
    );
    expect(isValidLottieJson(valid)).toBe(true);
  });

  it("rejects JSON missing v field", () => {
    const invalid = Buffer.from(JSON.stringify({ fr: 30, w: 512, h: 512, layers: [] }));
    expect(isValidLottieJson(invalid)).toBe(false);
  });

  it("rejects JSON missing layers field", () => {
    const invalid = Buffer.from(JSON.stringify({ v: "5.7.1", fr: 30, w: 512, h: 512 }));
    expect(isValidLottieJson(invalid)).toBe(false);
  });

  it("rejects JSON with wrong types", () => {
    const invalid = Buffer.from(
      JSON.stringify({ v: 5, fr: "thirty", w: 512, h: 512, layers: [] }),
    );
    expect(isValidLottieJson(invalid)).toBe(false);
  });

  it("rejects non-JSON content", () => {
    expect(isValidLottieJson(Buffer.from("not json at all"))).toBe(false);
  });

  it("rejects random JSON object", () => {
    const invalid = Buffer.from(JSON.stringify({ name: "test", value: 42 }));
    expect(isValidLottieJson(invalid)).toBe(false);
  });

  it("rejects JSON array", () => {
    expect(isValidLottieJson(Buffer.from("[1, 2, 3]"))).toBe(false);
  });
});

describe("isValidDotLottie", () => {
  it("accepts buffer with ZIP magic bytes", () => {
    const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(isValidDotLottie(zipBuffer)).toBe(true);
  });

  it("rejects buffer without ZIP magic bytes", () => {
    expect(isValidDotLottie(Buffer.from([0x00, 0x00, 0x00, 0x00]))).toBe(false);
  });

  it("rejects empty buffer", () => {
    expect(isValidDotLottie(Buffer.from([]))).toBe(false);
  });

  it("rejects buffer too short", () => {
    expect(isValidDotLottie(Buffer.from([0x50, 0x4b]))).toBe(false);
  });
});
