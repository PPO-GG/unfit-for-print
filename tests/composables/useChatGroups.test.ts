import { describe, expect, it } from "vitest";
import type { ChatMessage } from "~/composables/useLobbyReactive";
import { groupChatMessages } from "~/composables/useChatGroups";

function message(
  id: string,
  userId: string,
  timestamp: number,
  text = id,
  isSystem = false,
): ChatMessage {
  return { id, userId, name: userId, text, timestamp, isSystem };
}

describe("groupChatMessages", () => {
  it("groups adjacent player messages from the same sender within 60 seconds", () => {
    const messages = [
      message("one", "alice", 1_000),
      message("two", "alice", 61_000),
      message("three", "alice", 61_001),
    ];

    expect(groupChatMessages(messages)).toEqual([
      {
        type: "player",
        userId: "alice",
        name: "alice",
        messages,
      },
    ]);
  });

  it("starts groups at a sender change, after the elapsed-minute window, and for system messages", () => {
    const messages = [
      message("one", "alice", 1_000),
      message("two", "bob", 2_000),
      message("three", "bob", 63_001),
      message("system", "system", 64_000, "Alice joined", true),
      message("four", "bob", 65_000),
    ];

    expect(groupChatMessages(messages)).toEqual([
      {
        type: "player",
        userId: "alice",
        name: "alice",
        messages: [messages[0]],
      },
      {
        type: "player",
        userId: "bob",
        name: "bob",
        messages: [messages[1]],
      },
      {
        type: "player",
        userId: "bob",
        name: "bob",
        messages: [messages[2]],
      },
      { type: "system", message: messages[3] },
      {
        type: "player",
        userId: "bob",
        name: "bob",
        messages: [messages[4]],
      },
    ]);
  });
});
