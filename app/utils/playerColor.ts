/**
 * One accent colour per player, shared by the lobby's player cards, the ready
 * bar's pips and the compact list's avatars so all three always agree.
 *
 * The hash and palette are the ones LobbySeat and LobbyPlayerList each kept a
 * copy of; keeping them byte-for-byte means nobody's colour changes.
 */
export const PLAYER_PALETTE: readonly string[] = [
  "#5865f2", "#f43f5e", "#22d3ee", "#84cc16",
  "#f59e0b", "#a78bfa", "#fb7185", "#34d399",
];

const BOT_COLOR = "#f59e0b";
const BOT_GRADIENT = "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)";

type ColorSource = { userId?: string; $id?: string; playerType?: string };

export function playerColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PLAYER_PALETTE[hash % PLAYER_PALETTE.length]!;
}

export function playerAccent(p: ColorSource): string {
  if (p.playerType === "bot") return BOT_COLOR;
  return playerColor(p.userId ?? p.$id ?? "");
}

export function playerInitials(p: { name?: string; playerType?: string }): string {
  if (p.playerType === "bot") return "🤖";
  const name = p.name?.trim() ?? "";
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]!.charAt(0) + parts.at(-1)!.charAt(0)).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function playerAvatarStyle(p: ColorSource): Record<string, string> {
  if (p.playerType === "bot") return { background: BOT_GRADIENT, color: "#0d0f1a" };
  const color = playerAccent(p);
  return {
    background: `linear-gradient(135deg, ${color}aa 0%, ${color}55 100%)`,
    color: "#0d0f1a",
  };
}
