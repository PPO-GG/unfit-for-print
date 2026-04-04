import { decorationRegistry } from "~/utils/decorations";

interface OwnedDecoration {
  decorationId: string;
  acquiredAt: string;
  source: string;
}

export function useDecorations() {
  const userStore = useUserStore();
  const ownedDecorations = ref<OwnedDecoration[]>([]);
  const loading = ref(false);

  const activeDecorationId = computed(
    () => userStore.user?.prefs?.activeDecoration || null,
  );

  const fetchOwned = async () => {
    loading.value = true;
    try {
      const data = await $fetch<OwnedDecoration[]>("/api/decorations/list");
      ownedDecorations.value = data;
    } catch (err) {
      console.error("Failed to fetch decorations:", err);
    } finally {
      loading.value = false;
    }
  };

  const isOwned = (decorationId: string) =>
    ownedDecorations.value.some((d) => d.decorationId === decorationId);

  const equip = async (decorationId: string) => {
    await $fetch("/api/decorations/equip", {
      method: "POST",
      body: { decorationId },
    });
    if (userStore.user?.prefs) {
      userStore.user.prefs.activeDecoration = decorationId;
    }
  };

  const unequip = async () => {
    await $fetch("/api/decorations/equip", {
      method: "POST",
      body: { decorationId: null },
    });
    if (userStore.user?.prefs) {
      userStore.user.prefs.activeDecoration = undefined;
    }
  };

  const allDecorations = computed(() =>
    Object.entries(decorationRegistry).map(([id, entry]) => ({
      id,
      ...entry,
      owned: isOwned(id),
      active: activeDecorationId.value === id,
    })),
  );

  return {
    ownedDecorations,
    activeDecorationId,
    allDecorations,
    loading,
    fetchOwned,
    equip,
    unequip,
  };
}
