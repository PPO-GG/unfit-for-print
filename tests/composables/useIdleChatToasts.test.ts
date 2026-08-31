import { describe, expect, it } from "vitest";
import type { ChatMessage } from "~/composables/useLobbyReactive";
import { selectIdleChatToasts } from "~/composables/useIdleChatToasts";

function message(
  id: string,
  userId: string,
  isSystem = false,
): ChatMessage {
  return {
    id,
    userId,
    name: userId,
    text: id,
    timestamp: 1_000,
    isSystem,
  };
}

describe("selectIdleChatToasts", () => {
  it("returns the latest three remote non-system arrivals in arrival order", () => {
    const messages = [
      message("historic", "alice"),
      message("one", "alice"),
      message("mine", "me"),
      message("system", "system", true),
      message("two", "bob"),
      message("three", "carol"),
      message("four", "dave"),
    ];

    expect(
      selectIdleChatToasts(
        messages,
        "me",
        new Set(["one", "mine", "system", "two", "three", "four"]),
      ),
    ).toEqual([messages[4], messages[5], messages[6]]);
  });

  it("returns no rows when there are no arrivals", () => {
    expect(
      selectIdleChatToasts([message("remote", "alice")], "me", new Set()),
    ).toEqual([]);
  });
});
