import { describe, it, expect } from "vitest";
import { hexToUint8Array } from "../../server/utils/discord-verify";

describe("discord-verify", () => {
  describe("hexToUint8Array", () => {
    it("converts a hex string to Uint8Array", () => {
      const result = hexToUint8Array("48656c6c6f");
      expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    });

    it("handles empty string", () => {
      const result = hexToUint8Array("");
      expect(result).toEqual(new Uint8Array([]));
    });

    it("handles uppercase hex", () => {
      const result = hexToUint8Array("FF00AB");
      expect(result).toEqual(new Uint8Array([255, 0, 171]));
    });
  });
});
