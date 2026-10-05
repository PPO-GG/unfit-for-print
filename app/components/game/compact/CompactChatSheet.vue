<script setup lang="ts">
import type { ChatMessage } from "~/composables/useLobbyReactive";

const open = defineModel<boolean>("open", { default: false });
defineProps<{ messages: ChatMessage[] }>();

const { t } = useI18n();
</script>

<template>
  <!-- A fixed height rather than max-height: the message list fills it and
       scrolls, and the input stays pinned at the bottom of the sheet. -->
  <UDrawer
    v-model:open="open"
    direction="bottom"
    :title="t('compact.chat')"
    :ui="{
      content: 'lobby-tokens h-[80dvh]',
      container: 'flex-1 min-h-0',
      body: 'flex-1 min-h-0 flex flex-col p-0 pb-[var(--safe-bottom)]',
    }"
  >
    <template #body>
      <LobbyChat class="ccs-chat" :messages="messages" />
    </template>
  </UDrawer>
</template>

<style scoped>
.ccs-chat {
  flex: 1;
  min-height: 0;
  height: 100% !important;
}
/* The drawer carries the title; the panel's own header would repeat it. */
.ccs-chat :deep(.lobby-chat-toggle) {
  display: none;
}
.ccs-chat :deep(.lobby-chat-send) {
  min-height: 44px;
  min-width: 44px;
}
</style>
