<script setup lang="ts">
import markdownit from "markdown-it";
import privacypolicy from "../../../content/privacypolicy.md?raw";

useSeoMeta({
  title: "Privacy Policy",
  description:
    "How Unfit for Print collects, uses and protects your data.",
});

const md = new markdownit({
  html: true,
  linkify: true,
  typographer: true,
});

const content = md.render(privacypolicy);
</script>

<template>
  <!-- Top padding clears the layout's fixed back button. -->
  <div class="max-w-4xl mx-auto px-6 sm:px-10 pt-24 pb-12">
    <div class="prose prose-invert max-w-none" v-html="content" />
  </div>
</template>
