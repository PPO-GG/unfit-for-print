<script setup lang="ts">
useHead({ title: "Legal · Unfit for Print" });

const links = [
  {
    to: "/legal/termsofservice",
    label: "Terms of Service",
    icon: "i-solar-document-text-line-duotone",
  },
  {
    to: "/legal/privacypolicy",
    label: "Privacy Policy",
    icon: "i-solar-shield-check-line-duotone",
  },
];
</script>

<template>
  <div class="max-w-4xl mx-auto px-6 sm:px-10 py-12">
    <NuxtLink
      to="/"
      class="inline-flex items-center gap-1 text-muted hover:text-highlighted transition-colors mb-8"
    >
      <UIcon name="i-solar-arrow-left-line-duotone" />
      Back to home
    </NuxtLink>
    <h1 class="text-2xl font-semibold mb-6">Legal</h1>
    <ul class="flex flex-col gap-2">
      <li v-for="link in links" :key="link.to">
        <NuxtLink
          :to="link.to"
          class="flex items-center gap-2 px-4 py-3 rounded-lg border border-default hover:bg-elevated transition-colors"
        >
          <UIcon :name="link.icon" class="size-5" />
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
