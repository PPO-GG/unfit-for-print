<script setup lang="ts">
/**
 * Deleting an owned decoration revokes it from every owner, purchases
 * included (user_decorations cascades). So the modal leads with Hide, and
 * the destructive path needs the name typed back.
 */
import { ref, watch } from "vue";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ name: string; ownerCount: number }>();
const emit = defineEmits<{ hide: []; confirm: [] }>();

const typed = ref("");
watch(open, () => (typed.value = ""));

function confirmDelete() {
  if (typed.value.trim() !== props.name.trim()) return;
  emit("confirm");
}
</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="flex flex-col gap-4 p-6">
        <h2 class="text-lg font-bold">Delete “{{ name }}”?</h2>
        <p class="text-sm text-slate-300">
          <strong>{{ ownerCount }}</strong> player{{ ownerCount === 1 ? "" : "s" }} own this decoration.
          Deleting it removes it from all of them, including anyone who bought it. Hiding keeps it for
          current owners and takes it out of the catalog.
        </p>
        <UButton data-testid="delete-hide" color="primary" block @click="emit('hide')">Hide instead</UButton>
        <div class="flex flex-col gap-2 border-t border-slate-700 pt-4">
          <label class="text-xs text-slate-400">Type the decoration's name to delete it for everyone</label>
          <UInput v-model="typed" data-testid="delete-confirm-input" :placeholder="name" />
          <UButton data-testid="delete-confirm" color="error" variant="soft" block @click="confirmDelete">
            Delete for everyone
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
