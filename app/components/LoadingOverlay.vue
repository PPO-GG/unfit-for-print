<template>
  <div v-if="isLoading" class="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/80 backdrop-blur-sm transition-opacity duration-300" :class="{ 'opacity-0': !isLoading }">
    <div class="text-center">
	    <Icon name="svg-spinners:blocks-shuffle-3" size="64px" />
      <div class="text-white text-xl">{{ message || 'Loading...' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  isLoading: {
    type: Boolean,
    default: true
  },
  message: {
    type: String,
    default: ''
  }
});
</script>