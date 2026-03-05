<script setup lang="ts">
definePageMeta({ middleware: "admin" });
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 mb-1 text-sm text-slate-400">
      <NuxtLink to="/admin" class="hover:text-white transition-colors"
        >Admin</NuxtLink
      >
      <UIcon name="i-solar-alt-arrow-right-linear" class="text-xs" />
      <NuxtLink to="/admin/cards" class="hover:text-white transition-colors"
        >Card Manager</NuxtLink
      >
      <UIcon name="i-solar-alt-arrow-right-linear" class="text-xs" />
      <span class="text-white">Upload Pack</span>
    </div>

    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold tracking-tight">Upload Pack</h1>
        <p class="text-slate-400 mt-1">Seed new card packs from a JSON file</p>
      </div>
      <UButton
        to="/admin/cards"
        variant="ghost"
        color="neutral"
        icon="i-solar-alt-arrow-left-linear"
      >
        Back to Cards
      </UButton>
    </div>

    <!-- Upload card — uses the already refactored component -->
    <AdminCardManagerUpload />

    <!-- Format reference -->
    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-solar-info-square-bold-duotone"
            class="text-info-400"
          />
          <h3 class="font-semibold">Expected JSON Format</h3>
        </div>
      </template>
      <div class="text-sm text-slate-400 space-y-3">
        <p>
          The file should be a JSON array of card pack objects. Each pack object
          can have the following structure:
        </p>
        <pre
          class="bg-slate-900 rounded-lg p-4 overflow-x-auto text-xs text-slate-300 leading-relaxed"
        ><code>[
  {
    "name": "Base Pack",
    "white": [
      "A white card text.",
      "Another white card."
    ],
    "black": [
      { "text": "Black card with ___.", "pick": 1 },
      { "text": "Pick ___ and ___.", "pick": 2 }
    ]
  }
]</code></pre>
        <ul class="space-y-1 list-disc list-inside text-xs">
          <li>
            White cards: plain strings or objects with a
            <code class="text-slate-200">text</code> field
          </li>
          <li>
            Black cards: objects with
            <code class="text-slate-200">text</code> and
            <code class="text-slate-200">pick</code> (defaults to 1)
          </li>
          <li>
            Use <code class="text-slate-200">_</code> in black card text to
            represent blank slots
          </li>
          <li>
            Card text is limited to 255 characters; longer cards are skipped
          </li>
          <li>
            Exact or near-duplicate cards (≥ 80% similar) are automatically
            skipped
          </li>
        </ul>
      </div>
    </UCard>
  </div>
</template>
