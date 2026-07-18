<!--
  Decorations grid with rarity filter + "Shop decorations" CTA tile.
  Uses the real `useDecorations` composable — this is fully wired.
-->
<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-4">
      <div class="sect-h flex-1" style="margin-bottom: 0">
        <div class="title">
          Your decorations ·
          <span style="color: var(--ink-dim)">
            {{ ownedDecorations.length }} owned
          </span>
        </div>
      </div>

      <div class="filter-bar">
        <button
          v-for="f in filters"
          :key="f"
          type="button"
          class="filter-pill"
          :class="[
            { active: activeFilter === f },
            f !== 'all' ? `rare-${f}` : '',
          ]"
          @click="activeFilter = f"
        >
          {{ f }}
        </button>
      </div>

      <NuxtLink v-if="self" to="/store" class="profile-btn primary">
        <ProfileIcon name="star" :size="14" /> Get more decorations
      </NuxtLink>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-8"
    >
      <UIcon
        name="i-svg-spinners-ring-resize"
        class="text-3xl"
        :style="{ color: 'var(--accent-cyan)' }"
      />
    </div>

    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
    >
      <ProfileDecorationTile
        v-for="d in filteredOwned"
        :key="d.id"
        :deco="d"
        :self="self"
        :avatar-url="avatarUrl"
        :initials="initials"
        @equip="onEquip"
        @unequip="onUnequip"
        @buy="startPurchase"
      />

      <!-- "Shop decorations" CTA tile -->
      <NuxtLink
        v-if="self"
        to="/store"
        class="deco-tile"
        :style="{
          borderStyle: 'dashed',
          background: 'rgba(120,220,255,0.03)',
          color: 'var(--accent-cyan)',
          textDecoration: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }"
      >
        <div class="flex flex-col items-center gap-3">
          <div
            class="font-display"
            :style="{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              border: '2px solid var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              color: 'var(--accent-cyan)',
            }"
          >+</div>
          <div class="font-display uppercase" style="font-size: 14px">
            Shop decorations
          </div>
          <div
            class="font-mono uppercase"
            :style="{
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: 'var(--ink-muted)',
            }"
          >
            {{ lockedCount }} available
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Rarity } from "~/types/profile";

type RarityFilter = "all" | Rarity;

defineProps<{
  self: boolean;
  avatarUrl?: string | null;
  initials?: string;
}>();

const filters: RarityFilter[] = ["all", "common", "rare", "epic", "legendary"];
const activeFilter = ref<RarityFilter>("all");

const {
  allDecorations,
  loading,
  fetchAll,
  equip,
  unequip,
  startPurchase,
} = useDecorations();

onMounted(() => {
  void fetchAll();
});

const ownedDecorations = computed(() =>
  allDecorations.value.filter((d) => d.owned),
);

const lockedCount = computed(
  () => allDecorations.value.filter((d) => !d.owned).length,
);

const filteredOwned = computed(() => {
  if (activeFilter.value === "all") return ownedDecorations.value;
  return ownedDecorations.value.filter((d) => d.rarity === activeFilter.value);
});

async function onEquip(id: string) {
  await equip(id);
}
async function onUnequip() {
  await unequip();
}
// `startPurchase` is exposed via `@buy` on tiles, routed directly to
// `useDecorations().startPurchase` in the template.
</script>
