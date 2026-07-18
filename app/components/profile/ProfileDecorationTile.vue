<!--
  Single decoration tile inside the decorations grid. Clicking an owned
  tile toggles equip/unequip; clicking a locked tile triggers purchase
  (emits `buy`). The parent handles the actual wiring via
  `useDecorations`.
-->
<template>
  <button
    type="button"
    class="deco-tile"
    :class="[
      `rare-${rarity}`,
      { equipped: isEquipped, locked: !deco.owned },
    ]"
    :aria-label="deco.name"
    @click="onClick"
  >
    <div style="position: absolute; top: 10px; left: 12px">
      <ProfileRarityDots :rarity="rarity" />
    </div>

    <span v-if="!deco.owned" class="lock-overlay">
      <ProfileIcon name="lock" :size="12" />
    </span>

    <div class="deco-corner">
      <span
        v-if="isEquipped"
        class="font-mono"
        :style="{
          color: `var(--rare-${rarity})`,
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.18em',
        }"
      >
        ✓ ON
      </span>
      <span
        v-else-if="deco.owned"
        :style="{ color: 'var(--ink-muted)' }"
      >•••</span>
      <span
        v-else-if="priceLabel"
        class="font-mono"
        :style="{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--ink-dim)',
        }"
      >{{ priceLabel }}</span>
    </div>

    <div class="deco-preview">
      <AvatarDecoration
        :decoration-id="deco.id"
        :catalog-entry="(deco.catalogEntry ?? null) as any"
      >
        <UAvatar
          :src="avatarUrl ?? undefined"
          :alt="deco.name"
          class="font-display"
          :style="{
            width: '48px',
            height: '48px',
            fontSize: '14px',
            background: 'oklch(78% 0.20 195)',
            color: '#0a0d1c',
          }"
        >
          <template v-if="!avatarUrl">{{ initials }}</template>
        </UAvatar>
      </AvatarDecoration>
    </div>

    <div class="deco-name">{{ deco.name }}</div>
    <div class="rarity-label mt-auto pt-1">{{ rarity.toUpperCase() }}</div>
  </button>
</template>

<script setup lang="ts">
import type { Rarity } from "~/types/profile";

type DecoCard = {
  id: string;
  name: string;
  owned: boolean;
  active: boolean;
  rarity: string;
  discordSkuId: string | null;
  price: number;
  catalogEntry?: unknown;
};

const props = defineProps<{
  deco: DecoCard;
  self: boolean;
  avatarUrl?: string | null;
  initials?: string;
}>();

const emit = defineEmits<{
  equip: [id: string];
  unequip: [];
  buy: [id: string];
}>();

const rarity = computed<Rarity>(() => {
  const r = props.deco.rarity;
  if (r === "rare" || r === "epic" || r === "legendary") return r;
  return "common";
});

const isEquipped = computed(() => props.deco.active);

const priceLabel = computed(() => {
  if (props.deco.owned) return null;
  const p = props.deco.price;
  if (!Number.isFinite(p) || p <= 0) return null;
  return `$${p.toFixed(2)}`;
});

function onClick() {
  if (!props.self) return;
  if (!props.deco.owned) {
    if (props.deco.discordSkuId) emit("buy", props.deco.id);
    return;
  }
  if (isEquipped.value) emit("unequip");
  else emit("equip", props.deco.id);
}
</script>
