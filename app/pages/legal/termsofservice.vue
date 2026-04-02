<script setup lang="ts">
import markdownit from "markdown-it";
import termsofservice from "../../../content/termsofservice.md?raw";

useHead({ title: "Terms of Service · Unfit for Print" });

const md = new markdownit({
  html: true,
  linkify: true,
  typographer: true,
});

const content = md.render(termsofservice);
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
    <div class="prose prose-invert max-w-none" v-html="content" />
  </div>
</template>
