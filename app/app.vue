<template>
  <UApp>
    <NuxtLayout>
      <div
        v-if="isDev"
        class="fixed top-0 left-0 border-t-1 h-0 border-amber-500 w-full z-50 items-center flex justify-start"
      >
        <span
          class="text-[0.5em] dark:text-white text-black font-mono mt-4 ml-1"
          >DEV MODE</span
        >
      </div>
      <LoadingOverlay :is-loading="isPageLoading" />
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { useHead, useRuntimeConfig, useNuxtApp } from "#imports";
const isDev = import.meta.env.DEV;
const isPageLoading = ref(true);

// Handle page loading state
onMounted(() => {
  // Set loading to false after the page is mounted
  setTimeout(() => {
    isPageLoading.value = false;
  }, 250); // Small delay to ensure components are rendered
});

// Show loading overlay during page transitions
const nuxtApp = useNuxtApp();
nuxtApp.hook("page:start", () => {
  isPageLoading.value = true;
});
nuxtApp.hook("page:finish", () => {
  setTimeout(() => {
    isPageLoading.value = false;
  }, 200); // Small delay to ensure smooth transition
});
const config = useRuntimeConfig();

// Default SEO meta — individual pages (e.g. game/[code].vue) override via useHead()
useHead({
  title: "Unfit for Print",
  meta: [
    {
      name: "description",
      content:
        "Join the chaos in Unfit for Print – a Cards Against Humanity-inspired party game!",
    },
    { property: "og:site_name", content: "Unfit for Print" },
    { property: "og:title", content: "Unfit for Print" },
    {
      property: "og:description",
      content:
        "Join or create your own card game lobbies and cause chaos with friends.",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: config.public.baseUrl },
    { property: "og:image", content: `${config.public.baseUrl}/img/og.png` },
  ],
  link: [
    { rel: "canonical", href: config.public.baseUrl },
    {
      rel: "icon",
      type: "image/png",
      href: `${config.public.baseUrl}/img/favicon.png`,
    },
  ],
});
</script>
