import { computed, ref, watch, type Ref } from "vue";

/**
 * Messages that arrived while the chat was not on screen. History present
 * when the view mounts counts as read — a badge on join would just be noise.
 */
export function useChatUnread(count: Ref<number>, viewing: Ref<boolean>) {
  const seen = ref(count.value);
  watch(
    [count, viewing],
    ([c, v]) => {
      if (v) seen.value = c;
    },
    { immediate: true },
  );
  const unread = computed(() =>
    viewing.value ? 0 : Math.max(0, count.value - seen.value),
  );
  return { unread };
}
