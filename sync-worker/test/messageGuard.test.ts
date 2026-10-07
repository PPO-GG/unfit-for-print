import { describe, expect, it } from "vitest";
import {
  createMessageGuard,
  MAX_MESSAGE_BYTES,
  MAX_MESSAGES_PER_SECOND,
} from "../src/messageGuard";

describe("createMessageGuard", () => {
  it("rejects a message over 1 MiB", () => {
    const guard = createMessageGuard();
    expect(guard.check(MAX_MESSAGE_BYTES, 0)).toBe("ok");
    expect(guard.check(MAX_MESSAGE_BYTES + 1, 0)).toBe("too-large");
  });

  it("allows 200 messages in one second and rejects the 201st", () => {
    const guard = createMessageGuard();
    for (let i = 0; i < MAX_MESSAGES_PER_SECOND; i++) {
      expect(guard.check(10, 500)).toBe("ok");
    }
    expect(guard.check(10, 999)).toBe("rate-limited");
  });

  it("starts a fresh window after one second", () => {
    const guard = createMessageGuard();
    for (let i = 0; i < MAX_MESSAGES_PER_SECOND; i++) guard.check(10, 0);
    expect(guard.check(10, 1000)).toBe("ok");
  });
});
