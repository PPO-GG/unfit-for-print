import { describe, expect, it } from "vitest";
import {
  createMessageGuard,
  MAX_MESSAGE_BYTES,
  MAX_MESSAGES_PER_SECOND,
  MAX_SYNC_STEP2_BYTES,
} from "../src/messageGuard";

describe("createMessageGuard", () => {
  it("rejects a message over 1 MiB", () => {
    const guard = createMessageGuard();
    expect(guard.check(MAX_MESSAGE_BYTES, 0)).toBe("ok");
    expect(guard.check(MAX_MESSAGE_BYTES + 1, 0)).toBe("too-large");
  });

  it("allows a larger frame when given the sync step 2 limit, up to 8 MiB", () => {
    const guard = createMessageGuard();
    expect(guard.check(MAX_MESSAGE_BYTES + 1, 0, MAX_SYNC_STEP2_BYTES)).toBe("ok");
    expect(guard.check(MAX_SYNC_STEP2_BYTES, 0, MAX_SYNC_STEP2_BYTES)).toBe("ok");
    expect(guard.check(MAX_SYNC_STEP2_BYTES + 1, 0, MAX_SYNC_STEP2_BYTES)).toBe("too-large");
  });

  it("still counts large step 2 frames toward the rate limit", () => {
    const guard = createMessageGuard();
    for (let i = 0; i < MAX_MESSAGES_PER_SECOND; i++) {
      expect(guard.check(MAX_MESSAGE_BYTES + 1, 0, MAX_SYNC_STEP2_BYTES)).toBe("ok");
    }
    expect(guard.check(MAX_MESSAGE_BYTES + 1, 0, MAX_SYNC_STEP2_BYTES)).toBe("rate-limited");
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
