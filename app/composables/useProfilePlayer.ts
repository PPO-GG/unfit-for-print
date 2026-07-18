import type { ProfilePlayer, Rarity } from "~/types/profile";
import { PROFILE_PLAYER_OVERLAY_MOCK } from "~/composables/useProfileMockData";

/**
 * Compose a `ProfilePlayer` for the currently-logged-in user.
 *
 * Real fields: id, name, discord handle, avatar URL, equipped decoration,
 * joined date.
 *
 * Stubbed: level, xp, xpNext, title, bio (see PROFILE_PLAYER_OVERLAY_MOCK).
 * When XP/title systems ship, swap the overlay for real values from a
 * `GET /api/me/profile` endpoint.
 */
export function useProfilePlayer() {
  const userStore = useUserStore();
  const { catalog, activeDecorationId, fetchCatalog } = useDecorations();

  if (catalog.value.length === 0) {
    void fetchCatalog();
  }

  const initials = (name: string | null | undefined) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    const [first, second] = parts;
    if (parts.length >= 2 && first && second && first[0] && second[0]) {
      return (first[0] + second[0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const avatarUrl = computed<string | null>(() => {
    const user = userStore.user;
    if (!user?.prefs) return null;
    if (user.prefs.avatarUrl) return user.prefs.avatarUrl;
    if (user.prefs.discordUserId && user.prefs.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.prefs.discordUserId}/${user.prefs.avatar}.png`;
    }
    if (user.name) {
      return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(user.name)}`;
    }
    return null;
  });

  const joined = computed(() => {
    const created = userStore.user?.$createdAt;
    if (!created) return "—";
    try {
      const d = new Date(created);
      return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    } catch {
      return "—";
    }
  });

  const discordHandle = computed(() => {
    const u = userStore.user;
    if (!u) return null;
    if (u.provider !== "discord") return null;
    // Prefer Appwrite username (Discord handle is stored there in most setups).
    return u.name ?? null;
  });

  const equippedRarity = computed<Rarity | null>(() => {
    const id = activeDecorationId.value;
    if (!id) return null;
    const entry = catalog.value.find((d) => d.decorationId === id);
    const r = entry?.rarity as Rarity | undefined;
    if (r === "common" || r === "rare" || r === "epic" || r === "legendary") return r;
    return "common";
  });

  const player = computed<ProfilePlayer>(() => {
    const u = userStore.user;
    const name = u?.name?.toUpperCase() || "GUEST";
    return {
      id: u?.$id ?? "guest",
      name,
      discord: discordHandle.value,
      avatarUrl: avatarUrl.value,
      initials: initials(u?.name ?? null),
      avatarBg: "oklch(78% 0.20 195)",
      bio: PROFILE_PLAYER_OVERLAY_MOCK.bio,
      level: PROFILE_PLAYER_OVERLAY_MOCK.level,
      xp: PROFILE_PLAYER_OVERLAY_MOCK.xp,
      xpNext: PROFILE_PLAYER_OVERLAY_MOCK.xpNext,
      title: PROFILE_PLAYER_OVERLAY_MOCK.title,
      joined: joined.value,
      equippedDecoration: activeDecorationId.value ?? null,
      equippedRarity: equippedRarity.value,
    };
  });

  return { player };
}
