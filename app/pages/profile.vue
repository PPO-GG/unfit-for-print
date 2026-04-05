<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

const { t } = useI18n();
const userStore = useUserStore();
const {
  allDecorations,
  activeDecorationId,
  loading,
  fetchAll,
  equip,
  unequip,
  startPurchase,
} = useDecorations();

const hydrated = ref(false);
onMounted(() => {
  hydrated.value = true;
  fetchAll();
});

const ownedDecorations = computed(() =>
  allDecorations.value.filter((d) => d.owned),
);
const lockedDecorations = computed(() =>
  allDecorations.value.filter((d) => !d.owned),
);

const activeCatalogEntry = computed(() =>
  allDecorations.value.find((d) => d.active)?.catalogEntry ?? null,
);

const handleDecorationClick = async (
  decorationId: string,
  owned: boolean,
  active: boolean,
  discordSkuId: string | null,
) => {
  if (!owned) {
    if (discordSkuId) {
      startPurchase(decorationId);
    }
    return;
  }
  if (active) {
    await unequip();
  } else {
    await equip(decorationId);
  }
};

// Avatar URL resolution (same logic as AppHeader)
const avatarUrl = computed(() => {
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
</script>

<template>
  <div class="flex flex-col items-center p-6 max-w-3xl mx-auto space-y-8">
    <!-- Profile Header -->
    <div class="flex flex-col items-center gap-4">
      <template v-if="hydrated">
        <AvatarDecoration :decoration-id="activeDecorationId" :catalog-entry="activeCatalogEntry">
          <UAvatar
            :src="avatarUrl ?? undefined"
            :alt="userStore.user?.name ?? 'User'"
            class="size-24"
          />
        </AvatarDecoration>

        <div class="text-center">
          <h1 class="text-2xl font-bold">
            {{ userStore.user?.name ?? t("nav.welcome_guest") }}
          </h1>
          <UBadge
            :label="
              isAuthenticatedUser(userStore.user) ? 'Discord' : 'Anonymous'
            "
            :color="isAuthenticatedUser(userStore.user) ? 'info' : 'neutral'"
            variant="subtle"
            class="mt-1"
          />
        </div>
      </template>
      <template v-else>
        <USkeleton class="size-20 rounded-full" />
        <div class="flex flex-col items-center gap-2">
          <USkeleton class="h-8 w-40" />
          <USkeleton class="h-5 w-20" />
        </div>
      </template>
    </div>

    <!-- Owned Decorations -->
    <div class="w-full">
      <h2 class="text-xl font-semibold mb-4">
        {{ t("profile.your_decorations") }}
      </h2>

      <div v-if="loading" class="flex justify-center py-8">
        <UIcon
          name="i-svg-spinners-ring-resize"
          class="text-3xl text-amber-400"
        />
      </div>

      <div
        v-else-if="ownedDecorations.length === 0"
        class="text-center py-8 text-slate-400"
      >
        {{ t("profile.no_decorations") }}
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <button
          v-for="decoration in ownedDecorations"
          :key="decoration.id"
          class="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer"
          :class="
            decoration.active
              ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.3),0_0_14px_rgba(245,158,11,0.15)]'
              : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
          "
          @click="
            handleDecorationClick(
              decoration.id,
              decoration.owned,
              decoration.active,
              decoration.discordSkuId,
            )
          "
        >
          <!-- Rarity pips — top left -->
          <div
            v-if="decoration.rarity"
            class="absolute top-1.5 left-1.5 flex flex-col items-center gap-px leading-none"
            :class="rarityColorClass(decoration.rarity)"
            aria-hidden="true"
          >
            <span
              v-for="n in rarityPips(decoration.rarity)"
              :key="n"
              class="text-[8px] leading-none"
            >◆</span>
          </div>

          <!-- Category icon — top right -->
          <div v-if="decoration.category" class="absolute top-1.5 right-1.5" aria-hidden="true">
            <UIcon
              :name="categoryIcon(decoration.category)"
              class="text-sm text-slate-500"
            />
          </div>

          <AvatarDecoration :decoration-id="decoration.id" :catalog-entry="decoration.catalogEntry">
            <UAvatar
              :src="avatarUrl ?? undefined"
              :alt="userStore.user?.name ?? 'User'"
              class="size-24"
            />
          </AvatarDecoration>
          <span class="text-sm font-medium">{{ decoration.name }}</span>
          <p v-if="decoration.description" class="text-xs text-slate-500 mt-0.5 line-clamp-3">
            {{ decoration.description }}
          </p>
        </button>
      </div>
    </div>

    <!-- Locked Decorations -->
    <div v-if="lockedDecorations.length > 0" class="w-full">
      <h2 class="text-xl font-semibold mb-4 text-slate-400">
        {{ t("profile.locked_decorations") }}
      </h2>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div
          v-for="decoration in lockedDecorations"
          :key="decoration.id"
          class="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-800 bg-slate-900/50"
        >
          <!-- Rarity pips — top left -->
          <div
            v-if="decoration.rarity"
            class="absolute top-1.5 left-1.5 flex flex-col items-center gap-px leading-none opacity-50"
            :class="rarityColorClass(decoration.rarity)"
            aria-hidden="true"
          >
            <span
              v-for="n in rarityPips(decoration.rarity)"
              :key="n"
              class="text-[8px] leading-none"
            >◆</span>
          </div>

          <!-- Category icon — top right -->
          <div v-if="decoration.category" class="absolute top-1.5 right-1.5 opacity-50" aria-hidden="true">
            <UIcon
              :name="categoryIcon(decoration.category)"
              class="text-sm text-slate-500"
            />
          </div>

          <div class="relative">
            <AvatarDecoration :decoration-id="decoration.id" :catalog-entry="decoration.catalogEntry">
              <UAvatar
                :src="avatarUrl ?? undefined"
                :alt="userStore.user?.name ?? 'User'"
              />
            </AvatarDecoration>
            <div class="absolute inset-0 flex items-center justify-center">
              <UIcon name="i-solar-lock-bold" class="text-2xl text-slate-400" />
            </div>
          </div>
          <span class="text-sm font-medium text-slate-500">{{ decoration.name }}</span>
          <p v-if="decoration.description" class="text-xs text-slate-500 mt-0.5 line-clamp-3">
            {{ decoration.description }}
          </p>
          <span v-if="decoration.discordSkuId && decoration.price > 0" class="text-xs text-slate-400">
            ${{ decoration.price.toFixed(2) }}
          </span>
          <span v-else class="text-xs text-slate-400">Coming soon</span>
          <UButton
            v-if="decoration.discordSkuId"
            size="xs"
            variant="soft"
            class="mt-2"
            @click.stop="startPurchase(decoration.id)"
          >
            Purchase on Discord
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
