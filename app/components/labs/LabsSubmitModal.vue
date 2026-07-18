<!--
  Submit-a-card modal. Wraps the existing `CardSubmissionForm`
  component (which is fully wired to Appwrite) so we keep real submit
  + validation + toasts. The modal chrome (backdrop, pop-in animation,
  eyebrow, close button) comes from the new design.
-->
<template>
  <Transition name="labs-modal">
    <div
      v-if="open"
      class="ufp-labs-modal-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="emit('close')"
    >
      <div class="ufp-labs-modal">
        <div class="p-6 flex flex-col gap-5">
          <div class="flex items-center justify-between">
            <div>
              <div
                class="font-mono uppercase mb-1 flex items-center gap-2"
                :style="{
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  color: 'var(--accent-lime)',
                }"
              >
                <LabsIcon name="beaker" :size="11" /> SUBMIT TO LABS
              </div>
              <div
                class="font-display uppercase"
                :style="{ fontSize: '24px', color: 'var(--ink)' }"
              >
                New experiment
              </div>
            </div>
            <button class="labs-icon-btn" @click="emit('close')">
              <LabsIcon name="x" :size="16" />
            </button>
          </div>

          <ClientOnly>
            <CardSubmissionForm @card-submitted="onSubmitted" />
          </ClientOnly>

          <div
            class="font-cond leading-snug"
            :style="{
              fontSize: '13px',
              color: 'var(--ink-muted)',
              background: 'rgba(255,220,80,0.06)',
              border: '1px solid rgba(255,220,80,0.2)',
              padding: '12px',
              borderRadius: '8px',
            }"
          >
            <span
              class="font-display"
              :style="{
                fontSize: '10px',
                letterSpacing: '0.2em',
                color: 'var(--accent-yellow)',
              }"
            >HOUSE RULES · </span>
            Be funny, be unfit. No slurs, no real names, no actual
            harm. Cards that violate these get rejected and may cost
            you lab privileges.
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{ open: boolean }>();

const emit = defineEmits<{
  close: [];
  submitted: [submission: Record<string, unknown>];
}>();

function onSubmitted(newSubmission: Record<string, unknown>) {
  emit("submitted", newSubmission);
  emit("close");
}
</script>

<style>
.labs-modal-enter-active,
.labs-modal-leave-active {
  transition: opacity 0.2s ease;
}
.labs-modal-enter-from,
.labs-modal-leave-to {
  opacity: 0;
}
</style>
