// composables/useLobbyChat.ts
// Chat composable for the lobby Y.Doc.
// Replaces Appwrite gamechat collection + /api/chat/send + /api/chat/system.
//
// Messages are stored in Y.Array("chat") as JSON strings.
// Reactive via useLobbyReactive — this composable only handles sending.
//
// Usage:
//   const lobbyDoc = useLobbyDoc()
//   const chat = useLobbyChat(lobbyDoc)
//   chat.sendMessage("Hello!")
//   chat.sendSystemMessage("Game started")

import type { LobbyDocResult } from "~/composables/useLobbyDoc";

export function useLobbyChat(lobbyDoc: LobbyDocResult) {
  const userStore = useUserStore();

  const { doc, getChat } = lobbyDoc;

  const requireDoc = () => {
    if (!doc.value) throw new Error("[LobbyChat] No active Y.Doc");
    return doc.value;
  };

  /**
   * Send a player chat message.
   * Appends to Y.Array("chat") — syncs to all clients instantly.
   */
  const sendMessage = (text: string): void => {
    const trimmed = text.trim();
    if (!trimmed) return;

    requireDoc().transact(() => {
      getChat().push([
        JSON.stringify({
          id: crypto.randomUUID(),
          userId: userStore.user?.$id ?? "anonymous",
          name: userStore.user?.name ?? "Anonymous",
          text: trimmed,
          timestamp: Date.now(),
          isSystem: false,
        }),
      ]);
    });
  };

  /**
   * Send a system message (e.g., "Alice played a card", "New round started").
   * Same mechanism as player messages but flagged as system.
   */
  const sendSystemMessage = (text: string): void => {
    requireDoc().transact(() => {
      getChat().push([
        JSON.stringify({
          id: crypto.randomUUID(),
          userId: "system",
          name: "System",
          text,
          timestamp: Date.now(),
          isSystem: true,
        }),
      ]);
    });
  };

  return {
    sendMessage,
    sendSystemMessage,
  };
}
