import type { ChatMessage } from "~/composables/useLobbyReactive";

export function selectIdleChatToasts(
  messages: ChatMessage[],
  currentUserId: string | undefined,
  arrivalIds: ReadonlySet<string>,
  limit = 3,
): ChatMessage[] {
  return messages
    .filter(
      (message) =>
        arrivalIds.has(message.id) &&
        !message.isSystem &&
        message.userId !== currentUserId,
    )
    .slice(-limit);
}
