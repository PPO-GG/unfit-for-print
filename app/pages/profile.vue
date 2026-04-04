<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

const { t } = useI18n();
const userStore = useUserStore();
const { allDecorations, activeDecorationId, loading, fetchOwned, equip, unequip } =
  useDecorations();

await fetchOwned();

const ownedDecorations = computed(() =>
  allDecorations.value.filter((d) => d.owned),
);
const lockedDecorations = computed(() =>
  allDecorations.value.filter((d) => !d.owned),
);

const handleDecorationClick = async (decorationId: string, owned: boolean, active: boolean) => {
  if (!owned) return;
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
      <AvatarDecoration
        :decoration-id="activeDecorationId"
        size="xl"
      >
        <UAvatar
          :src="avatarUrl ?? undefined"
          :alt="userStore.user?.name ?? 'User'"
          size="3xl"
        />
      </AvatarDecoration>

      <div class="text-center">
        <h1 class="text-2xl font-bold">{{ userStore.user?.name ?? t("nav.welcome_guest") }}</h1>
        <UBadge
          :label="userStore.user?.provider === 'discord' ? 'Discord' : 'Anonymous'"
          :color="userStore.user?.provider === 'discord' ? 'info' : 'neutral'"
          variant="subtle"
          class="mt-1"
        />
      </div>
    </div>

    <!-- Owned Decorations -->
    <div class="w-full">
      <h2 class="text-xl font-semibold mb-4">{{ t("profile.your_decorations") }}</h2>

      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-svg-spinners-ring-resize" class="text-3xl text-amber-400" />
      </div>

      <div v-else-if="ownedDecorations.length === 0" class="text-center py-8 text-slate-400">
        {{ t("profile.no_decorations") }}
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <button
          v-for="decoration in ownedDecorations"
          :key="decoration.id"
          class="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer"
          :class="decoration.active
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'"
          @click="handleDecorationClick(decoration.id, decoration.owned, decoration.active)"
        >
          <AvatarDecoration
            :decoration-id="decoration.id"
            size="lg"
          >
            <UAvatar
              src="https://api.dicebear.com/9.x/fun-emoji/svg?seed=preview&backgroundColor=1e293b"
              size="xl"
              class="!w-16 !h-16"
            />
          </AvatarDecoration>
          <span class="text-sm font-medium">{{ decoration.name }}</span>
          <UBadge
            v-if="decoration.active"
            :label="t('profile.equipped')"
            color="warning"
            variant="subtle"
            size="xs"
          />
        </button>
      </div>
    </div>

    <!-- Locked Decorations -->
    <div v-if="lockedDecorations.length > 0" class="w-full">
      <h2 class="text-xl font-semibold mb-4 text-slate-400">{{ t("profile.locked_decorations") }}</h2>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div
          v-for="decoration in lockedDecorations"
          :key="decoration.id"
          class="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-800 bg-slate-900/50 opacity-50"
        >
          <div class="relative">
            <AvatarDecoration
              :decoration-id="decoration.id"
              size="lg"
            >
              <UAvatar
                src="https://api.dicebear.com/9.x/fun-emoji/svg?seed=preview&backgroundColor=1e293b"
                size="xl"
                class="!w-16 !h-16"
              />
            </AvatarDecoration>
            <div class="absolute inset-0 flex items-center justify-center">
              <UIcon name="i-solar-lock-bold" class="text-2xl text-slate-400" />
            </div>
          </div>
          <span class="text-sm font-medium text-slate-500">{{ decoration.name }}</span>
          <span class="text-xs text-slate-600">{{ t("profile.support_to_unlock") }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
