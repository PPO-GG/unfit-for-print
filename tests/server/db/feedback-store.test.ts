// The upsert is the whole trick of the prompt: a star tap writes at once,
// and "Tell us more" must enrich that same row — and must claim the Discord
// ping exactly once, however many times the player resubmits.

import { beforeEach, describe, expect, it } from "vitest";
import { useDb } from "~/server/db/client";
import { feedback } from "~/server/db/schema";
import { upsertFeedback } from "~/server/utils/feedbackStore";
import type { NormalizedFeedback } from "~/server/utils/feedbackIngest";

const db = useDb();
const REF = "3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a1b";

function input(over: Partial<NormalizedFeedback> = {}): NormalizedFeedback {
  return {
    clientRef: REF,
    rating: null,
    topics: [],
    message: null,
    source: "game_over_prompt",
    lobbyCode: "AB2C",
    gamesCompletedHint: 3,
    platform: "web",
    appVersion: "3.34.0",
    ...over,
  };
}

beforeEach(async () => {
  await db.delete(feedback);
});

describe("upsertFeedback", () => {
  it("inserts a star-only row without claiming a notification", async () => {
    const r = await upsertFeedback(input({ rating: 4 }), { userId: null });
    expect(r.messageIsNew).toBe(false);
    expect(r.row.rating).toBe(4);
    expect(r.row.notifiedAt).toBeNull();
    expect(await db.select().from(feedback)).toHaveLength(1);
  });

  it("enriches the same row when the follow-up arrives", async () => {
    await upsertFeedback(input({ rating: 4 }), { userId: null });
    const r = await upsertFeedback(
      input({ message: "more bots", topics: ["bots"], source: "game_over_prompt" }),
      { userId: null },
    );

    const rows = await db.select().from(feedback);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rating).toBe(4); // not cleared by a null rating
    expect(rows[0]!.message).toBe("more bots");
    expect(rows[0]!.topics).toEqual(["bots"]);
    expect(r.messageIsNew).toBe(true);
    expect(r.row.notifiedAt).not.toBeNull();
  });

  it("lets a later non-null rating overwrite the first", async () => {
    await upsertFeedback(input({ rating: 2 }), { userId: null });
    await upsertFeedback(input({ rating: 5 }), { userId: null });
    const [row] = await db.select().from(feedback);
    expect(row!.rating).toBe(5);
  });

  it("does not clear topics with an empty array", async () => {
    await upsertFeedback(input({ rating: 3, topics: ["cards"] }), { userId: null });
    await upsertFeedback(input({ rating: 3, topics: [] }), { userId: null });
    const [row] = await db.select().from(feedback);
    expect(row!.topics).toEqual(["cards"]);
  });

  it("claims the notification only once even if the message is edited", async () => {
    const first = await upsertFeedback(input({ message: "one" }), { userId: null });
    const second = await upsertFeedback(input({ message: "one, edited" }), { userId: null });
    expect(first.messageIsNew).toBe(true);
    expect(second.messageIsNew).toBe(false);
    const [row] = await db.select().from(feedback);
    expect(row!.message).toBe("one, edited");
  });

  it("keeps first-write metadata and fills a missing user id", async () => {
    await upsertFeedback(input({ rating: 4 }), { userId: null });
    await upsertFeedback(
      input({ message: "hi", source: "feedback_modal", lobbyCode: "ZZZZ", appVersion: "9.9.9" }),
      { userId: "00000000-0000-0000-0000-0000000000aa" },
    );
    const [row] = await db.select().from(feedback);
    expect(row!.source).toBe("game_over_prompt");
    expect(row!.lobbyCode).toBe("AB2C");
    expect(row!.appVersion).toBe("3.34.0");
    expect(row!.userId).toBe("00000000-0000-0000-0000-0000000000aa");
  });

  it("refuses an out-of-range rating at the database too", async () => {
    await expect(
      upsertFeedback(input({ rating: 9 }), { userId: null }),
    ).rejects.toThrow();
  });
});
