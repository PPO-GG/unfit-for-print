import { decorationRegistry } from "~/utils/decorations";
import type { DecorationCatalogEntry } from "~/types/decoration";

interface OwnedDecoration {
  decorationId: string;
  acquiredAt: string;
  source: string;
}

export function useDecorations() {
  const userStore = useUserStore();
  const catalog = ref<DecorationCatalogEntry[]>([]);
  const ownedDecorations = ref<OwnedDecoration[]>([]);
  const loading = ref(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${userStore.session?.$id}`,
    "x-appwrite-user-id": userStore.user?.$id ?? "",
  });

  const activeDecorationId = computed(
    () => userStore.user?.prefs?.activeDecoration || null,
  );

  const fetchCatalog = async () => {
    try {
      const data = await $fetch<DecorationCatalogEntry[]>(
        "/api/decorations/catalog",
      );
      catalog.value = data;
    } catch (err) {
      console.error("Failed to fetch decoration catalog:", err);
    }
  };

  const fetchOwned = async () => {
    loading.value = true;
    try {
      const data = await $fetch<OwnedDecoration[]>("/api/decorations/list", {
        headers: authHeaders(),
      });
      ownedDecorations.value = data;
    } catch (err) {
      console.error("Failed to fetch decorations:", err);
    } finally {
      loading.value = false;
    }
  };

  const fetchAll = async () => {
    await Promise.all([fetchCatalog(), fetchOwned()]);
  };

  const isOwned = (decorationId: string) =>
    ownedDecorations.value.some((d) => d.decorationId === decorationId);

  const equip = async (decorationId: string) => {
    await $fetch("/api/decorations/equip", {
      method: "POST",
      headers: authHeaders(),
      body: { decorationId },
    });
    if (userStore.user?.prefs) {
      userStore.user.prefs.activeDecoration = decorationId;
    }
  };

  const unequip = async () => {
    await $fetch("/api/decorations/equip", {
      method: "POST",
      headers: authHeaders(),
      body: { decorationId: null },
    });
    if (userStore.user?.prefs) {
      userStore.user.prefs.activeDecoration = undefined;
    }
  };

  const allDecorations = computed(() =>
    catalog.value.map((entry) => ({
      ...entry,
      component: decorationRegistry[entry.decorationId]?.component ?? null,
      owned: entry.freeForAll || isOwned(entry.decorationId),
      active: activeDecorationId.value === entry.decorationId,
    })),
  );

  const startPurchase = (decorationId: string) => {
    const entry = catalog.value.find((d) => d.decorationId === decorationId);
    if (!entry?.discordSkuId) return;

    const { isDiscordActivity } = useDiscordSDK();
    const clientId = useRuntimeConfig().public.discordClientId as string;
    const storeUrl = `https://discord.com/application-directory/${clientId}/store/${entry.discordSkuId}`;

    if (isDiscordActivity.value) {
      const { getSdk } = useDiscordSDK();
      const sdk = getSdk();
      if (sdk) {
        sdk.commands.openExternalLink({ url: storeUrl });
      }
    } else {
      window.open(storeUrl, "_blank");
    }
  };

  return {
    catalog,
    ownedDecorations,
    activeDecorationId,
    allDecorations,
    loading,
    fetchCatalog,
    fetchOwned,
    fetchAll,
    equip,
    unequip,
    startPurchase,
  };
}
