<template>
  <component
    :is="tag"
    :to="isLink ? to : undefined"
    :type="!isLink ? 'button' : undefined"
    :disabled="!isLink ? disabled || loading : undefined"
    :aria-disabled="disabled || loading || undefined"
    class="menu-tile"
    :class="[accentClasses[accent], { 'menu-tile--featured': featured }]"
    @click="onClick"
  >
    <div class="flex items-start justify-between">
      <span class="menu-tile__icon" :class="iconWrapClasses[accent]">
        <UIcon
          :name="loading ? 'i-lucide-loader-circle' : icon"
          :class="['size-5', { 'animate-spin': loading }]"
        />
      </span>
      <span v-if="badge" class="menu-tile__badge">{{ badge }}</span>
    </div>

    <div class="mt-auto pt-4">
      <div
        class="font-display leading-none tracking-wide"
        :class="featured ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'"
      >
        {{ label }}
      </div>
      <p v-if="description" class="menu-tile__description">
        {{ description }}
      </p>
      <slot name="extra" />
    </div>

    <kbd v-if="shortcut" class="menu-tile__shortcut">{{ shortcut }}</kbd>
  </component>
</template>

<script setup lang="ts">
import { computed, resolveComponent } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    icon: string;
    accent?:
      | "primary"
      | "secondary"
      | "info"
      | "success"
      | "warning"
      | "dark"
      | "discord"
      | "error";
    featured?: boolean;
    to?: string;
    loading?: boolean;
    disabled?: boolean;
    badge?: string;
    description?: string;
    shortcut?: string;
  }>(),
  {
    accent: "dark",
    featured: false,
    loading: false,
    disabled: false,
  },
);

const emit = defineEmits<{ click: [MouseEvent] }>();

const NuxtLink = resolveComponent("NuxtLink");
const isLink = computed(() => !!props.to && !props.disabled);
const tag = computed(() => (isLink.value ? NuxtLink : "button"));

const accentClasses: Record<string, string> = {
  primary: "bg-primary-400 text-slate-950 hover:bg-primary-300",
  secondary: "bg-secondary-400 text-slate-950 hover:bg-secondary-300",
  info: "bg-info-400 text-slate-950 hover:bg-info-300",
  success: "bg-success-400 text-slate-950 hover:bg-success-300",
  warning: "bg-warning-400 text-slate-950 hover:bg-warning-300",
  dark: "bg-slate-900/70 text-slate-100 outline-1 outline-slate-700/50 hover:bg-slate-900",
  discord:
    "bg-slate-900/70 text-slate-100 outline-1 outline-slate-700/50 hover:bg-slate-900",
  error: "bg-red-400 text-slate-950 hover:bg-red-300",
};

const iconWrapClasses: Record<string, string> = {
  primary: "bg-slate-950/10 text-slate-950",
  secondary: "bg-slate-950/10 text-slate-950",
  info: "bg-slate-950/10 text-slate-950",
  success: "bg-slate-950/10 text-slate-950",
  warning: "bg-slate-950/10 text-slate-950",
  dark: "bg-white/5 text-slate-100 outline-1 outline-slate-700/50",
  discord: "bg-white/5 text-[#5865f2] outline-1 outline-slate-700/50",
  error: "bg-slate-950/10 text-slate-950",
};

function onClick(e: MouseEvent) {
  if (props.disabled || props.loading) return;
  emit("click", e);
}
</script>

<style scoped>
.menu-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  min-height: 140px;
  padding: 16px;
  border-radius: 1rem;
  text-align: left;
  cursor: pointer;
  transition:
    transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1.4),
    box-shadow 200ms ease,
    background-color 150ms ease;
}

.menu-tile--featured {
  min-height: 300px;
  padding: 22px 20px;
}

.menu-tile:hover:not(:disabled):not([aria-disabled="true"]) {
  transform: translateY(-4px) rotate(-0.4deg);
  box-shadow: 0 20px 40px -16px rgba(0, 0, 0, 0.55);
}

.menu-tile:disabled,
.menu-tile[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.menu-tile__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.625rem;
  flex-shrink: 0;
}

.menu-tile__badge {
  font-family: var(--font-display);
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.15);
}

.menu-tile__description {
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
  opacity: 0.65;
}

.menu-tile__shortcut {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  border: 1px solid currentColor;
  border-radius: 0.375rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  line-height: 1;
  opacity: 0.55;
}

.menu-tile--featured .menu-tile__shortcut {
  right: 1.25rem;
  bottom: 1.375rem;
}
</style>
