<script setup lang="ts">
useHead({ title: "Changelog · Unfit for Print" });

const { data: versions, status } = await useFetch(
  computed(() => `https://ungh.cc/repos/PPO-GG/unfit-for-print/releases`),
  {
    transform: (data: {
      releases: {
        name?: string;
        tag: string;
        publishedAt: string;
        markdown: string;
      }[];
    }) => {
      return data.releases.map((release) => ({
        tag: release.tag,
        title: release.name || release.tag,
        date: release.publishedAt,
        markdown: release.markdown,
      }));
    },
  },
);

const latestTag = computed(() => versions.value?.[0]?.tag ?? null);
const isPending = computed(() => status.value === "pending");
</script>

<template>
  <div class="min-h-screen xl:grid xl:grid-cols-2">
    <!-- ── Left: sticky hero panel ─────────────────────────────── -->
    <UPageSection
      title="Changelog"
      description="All the latest updates and releases for Unfit for Print."
      orientation="vertical"
      :links="[
        {
          label: 'GitHub',
          icon: 'i-simple-icons-github',
          variant: 'ghost',
          size: 'md',
          to: 'https://github.com/PPO-GG/unfit-for-print',
          target: '_blank',
        },
      ]"
      :ui="{
        root: 'border-b border-default xl:border-b-0 xl:sticky xl:inset-y-0 xl:h-screen overflow-hidden',
        container: 'h-full items-center justify-center',
        wrapper: 'flex flex-col',
        headline: 'mb-6',
        title: 'text-left text-5xl font-bold tracking-tight',
        description: 'text-left max-w-lg text-base opacity-70',
        links: 'gap-1 justify-start -ms-2.5 mt-2',
      }"
    >
      <!-- Logo above the title -->
      <template #headline>
        <div class="flex items-center gap-3">
          <img
            src="/img/ufp2.svg"
            alt="Unfit for Print"
            class="h-8 w-auto shrink-0 drop-shadow-lg"
          />
          <!-- Latest version badge -->
          <UBadge
            v-if="latestTag"
            :label="latestTag"
            color="primary"
            variant="subtle"
            size="md"
            class="font-mono tracking-wide"
          />
          <USkeleton v-else-if="isPending" class="h-6 w-20 rounded-full" />
        </div>
      </template>

      <template #default />
    </UPageSection>

    <!-- ── Right: changelog scroll ──────────────────────────────── -->
    <section class="px-4 sm:px-6 xl:px-0 xl:-ms-30 xl:flex-1">
      <!-- Loading skeletons -->
      <div v-if="isPending" class="py-16 sm:py-24 lg:py-32 space-y-16 max-w-xl">
        <div v-for="i in 3" :key="i" class="space-y-4">
          <div class="flex items-center gap-4">
            <USkeleton class="h-5 w-24 rounded-full" />
            <USkeleton class="h-4 w-32 rounded" />
          </div>
          <USkeleton class="h-8 w-48 rounded-lg" />
          <USkeleton class="h-4 w-full rounded" />
          <USkeleton class="h-4 w-5/6 rounded" />
          <USkeleton class="h-4 w-4/6 rounded" />
        </div>
      </div>

      <!-- Actual changelog -->
      <UChangelogVersions
        v-else
        as="main"
        :indicator-motion="false"
        :ui="{
          root: 'py-16 sm:py-24 lg:py-32',
          indicator: 'inset-y-0',
        }"
      >
        <UChangelogVersion
          v-for="version in versions"
          :key="version.tag"
          v-bind="version"
          :ui="{
            root: 'flex items-start',
            container: 'w-xl ms-0 me-auto ml-12',
            header: 'border-b border-default pb-4',
            title: 'text-3xl font-bold tracking-tight',
            date: 'text-xs/9 text-primary font-mono font-semibold',
            indicator:
              'sticky top-0 pt-16 -mt-16 sm:pt-24 sm:-mt-24 lg:pt-32 lg:-mt-32',
          }"
        >
          <template #body>
            <div
              class="prose prose-invert prose-sm max-w-none mt-4 rounded-xl p-4 bg-white/3 backdrop-blur-sm ring-1 ring-white/8"
            >
              <MDC v-if="version.markdown" :value="version.markdown" />
            </div>
          </template>
        </UChangelogVersion>
      </UChangelogVersions>
    </section>
  </div>
</template>
