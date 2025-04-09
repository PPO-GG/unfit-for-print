<template>
  <div
    class="fixed bottom-4 left-4 z-9999 flex flex-col gap-2 pointer-events-none"
  >
    <div
      v-for="note in store.notifications"
      :key="note.id"
      class="flex items-start gap-2 px-4 py-3 rounded-sm shadow-md text-white pointer-events-auto"
      :class="{
        'bg-blue-600': note.type === 'info',
        'bg-green-600': note.type === 'success',
        'bg-red-600': note.type === 'error',
      }"
    >
      <span v-if="note.icon" class="text-lg">{{ note.icon }}</span>
      <span class="flex-1">{{ note.message }}</span>
      <button
        v-if="note.dismissible !== false"
        @click="handleDismiss(note.id)"
        class="ml-2 text-white/70 hover:text-white"
      >
        ✖
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotifications } from "~/composables/useNotifications";
import { useNotificationStore } from "~/stores/notificationStore";

const store = useNotificationStore();
const notifications = store.notifications;
const dismiss = store.dismiss;

const handleDismiss = (id: number) => {
  dismiss(id);
}
</script>
