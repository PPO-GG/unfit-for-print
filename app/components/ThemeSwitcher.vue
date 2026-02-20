<script setup lang="ts">
import { useUserPrefsStore } from '~/stores/userPrefsStore';
import { useColorMode } from '#imports';

const userPrefsStore = useUserPrefsStore();
const colorMode = useColorMode();

// Sync the theme between userPrefsStore and colorMode
watch(() => userPrefsStore.theme, (newTheme) => {
  colorMode.preference = newTheme;
}, { immediate: true });

// Computed property to handle the theme toggle
const isDarkTheme = computed({
  get: () => userPrefsStore.theme === 'dark',
  set: (value) => {
    userPrefsStore.setTheme(value ? 'dark' : 'light');
  }
});

// Function to toggle between light, dark, and system themes
function toggleTheme() {
  const currentTheme = userPrefsStore.theme;
  if (currentTheme === 'light') {
    userPrefsStore.setTheme('dark');
  } else if (currentTheme === 'dark') {
    userPrefsStore.setTheme('system');
  } else {
    userPrefsStore.setTheme('light');
  }
}

// Get the appropriate icon based on current theme
const themeIcon = computed(() => {
  switch (userPrefsStore.theme) {
    case 'light':
      return 'i-solar-sun-2-bold-duotone';
    case 'dark':
      return 'i-solar-moon-stars-bold-duotone';
    case 'system':
      return 'i-solar-settings-bold-duotone';
  }
});
</script>

<template>
  <div class="theme-switcher">
    <!-- Simple toggle button approach -->
    <UButton
      :icon="themeIcon"
      color="neutral"
      size="xl"
      variant="ghost"
      @click="toggleTheme"
      aria-label="Toggle theme"
    />
  </div>
</template>

<style scoped>
.theme-switcher {
  display: inline-flex;
}
</style>
