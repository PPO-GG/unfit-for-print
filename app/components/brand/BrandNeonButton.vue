<!--
  Big clacky neon button. Renders as a <button>, <a>, or NuxtLink
  depending on the `to`/`href` props.

  Variants: primary (yellow), pink, cyan, lime, ghost, default (neutral).
-->
<template>
  <component
    :is="elementTag"
    :to="to"
    :href="href"
    :type="elementTag === 'button' ? (type ?? 'button') : undefined"
    :disabled="elementTag === 'button' ? disabled : undefined"
    :class="['neon-btn', variant]"
    @click="onClick"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { resolveComponent } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "primary" | "pink" | "cyan" | "lime" | "ghost" | "default";
    /** Nuxt/Vue router target. If set, renders as NuxtLink. */
    to?: string;
    /** External link target. If set, renders as <a>. */
    href?: string;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  { variant: "default" },
);

const emit = defineEmits<{ click: [ev: MouseEvent] }>();

const NuxtLink = resolveComponent("NuxtLink");

const elementTag = computed(() => {
  if (props.to) return NuxtLink;
  if (props.href) return "a";
  return "button";
});

function onClick(ev: MouseEvent) {
  if (props.disabled) {
    ev.preventDefault();
    return;
  }
  emit("click", ev);
}
</script>
