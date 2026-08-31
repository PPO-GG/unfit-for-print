import type { ChatMessage } from "~/composables/useLobbyReactive";

export type ChatMessageGroup =
  | {
      type: "system";
      message: ChatMessage;
    }
  | {
      type: "player";
      userId: string;
      name: string;
      messages: ChatMessage[];
    };

const DEFAULT_WINDOW_MS = 60_000;

export function groupChatMessages(
  messages: ChatMessage[],
  windowMs = DEFAULT_WINDOW_MS,
): ChatMessageGroup[] {
  const groups: ChatMessageGroup[] = [];

  for (const message of messages) {
    if (message.isSystem) {
      groups.push({ type: "system", message });
      continue;
    }

    const previous = groups.at(-1);
    if (
      previous?.type === "player" &&
      previous.userId === message.userId &&
      message.timestamp - previous.messages.at(-1)!.timestamp <= windowMs
    ) {
      previous.messages.push(message);
      continue;
    }

    groups.push({
      type: "player",
      userId: message.userId,
      name: message.name,
      messages: [message],
    });
  }

  return groups;
}
