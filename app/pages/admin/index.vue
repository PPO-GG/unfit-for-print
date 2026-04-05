<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});

import { useIsAdmin } from "~/composables/useAdminCheck";

const isAdmin = useIsAdmin();
</script>

<template>
  <div>
    <ClientOnly>
    <div v-if="isAdmin" class="p-6 max-w-7xl mx-auto space-y-10">
      <!-- Header -->
      <div>
        <h1 class="text-5xl font-bold">Admin Dashboard</h1>
        <p class="text-gray-400 text-xl mt-1">
          Manage cards, monitor lobbies, and administer users
        </p>
      </div>

      <!-- ── Card Management Section ─────────────────────────────────────────── -->
      <section>
        <h2
          class="text-lg font-semibold uppercase tracking-widest text-slate-500 mb-3"
        >
          Card Management
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Card Browser -->
          <NuxtLink to="/admin/cards" class="group block">
            <UCard
              class="h-full border border-transparent group-hover:border-primary-500/40 transition-all group-hover:shadow-[0_0_24px_rgba(99,102,241,0.15)]"
            >
              <div class="flex items-start gap-4 p-1">
                <div
                  class="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-600/30 transition-colors"
                >
                  <UIcon
                    name="i-solar-documents-bold-duotone"
                    class="text-2xl text-primary-400"
                  />
                </div>
                <div>
                  <h3
                    class="font-bold text-lg mb-1 group-hover:text-primary-300 transition-colors"
                  >
                    Browse Cards
                  </h3>
                  <p class="text-slate-400 text-sm leading-relaxed">
                    Browse all card packs, preview cards visually, and manage
                    individual card status
                  </p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Upload Pack -->
          <NuxtLink to="/admin/cards/upload" class="group block">
            <UCard
              class="h-full border border-transparent group-hover:border-blue-500/40 transition-all group-hover:shadow-[0_0_24px_rgba(59,130,246,0.15)]"
            >
              <div class="flex items-start gap-4 p-1">
                <div
                  class="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600/30 transition-colors"
                >
                  <UIcon
                    name="i-solar-cloud-upload-bold-duotone"
                    class="text-2xl text-blue-400"
                  />
                </div>
                <div>
                  <h3
                    class="font-bold text-lg mb-1 group-hover:text-blue-300 transition-colors"
                  >
                    Upload Pack
                  </h3>
                  <p class="text-slate-400 text-sm leading-relaxed">
                    Seed new card packs from a JSON file with streaming progress
                    and resume support
                  </p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Duplicates -->
          <NuxtLink to="/admin/cards/duplicates" class="group block">
            <UCard
              class="h-full border border-transparent group-hover:border-amber-500/40 transition-all group-hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]"
            >
              <div class="flex items-start gap-4 p-1">
                <div
                  class="w-12 h-12 rounded-xl bg-amber-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-600/30 transition-colors"
                >
                  <UIcon
                    name="i-solar-copy-bold-duotone"
                    class="text-2xl text-amber-400"
                  />
                </div>
                <div>
                  <h3
                    class="font-bold text-lg mb-1 group-hover:text-amber-300 transition-colors"
                  >
                    Find Duplicates
                  </h3>
                  <p class="text-slate-400 text-sm leading-relaxed">
                    Scan for near-duplicate cards with configurable similarity
                    threshold and resolve them one-by-one
                  </p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>

      <!-- ── Store & Cosmetics Section ──────────────────────────────────────── -->
      <section>
        <h2
          class="text-lg font-semibold uppercase tracking-widest text-slate-500 mb-3"
        >
          Store & Cosmetics
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NuxtLink to="/admin/decorations" class="group block">
            <UCard
              class="h-full border border-transparent group-hover:border-violet-500/40 transition-all group-hover:shadow-[0_0_24px_rgba(139,92,246,0.15)]"
            >
              <div class="flex items-start gap-4 p-1">
                <div
                  class="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/30 transition-colors"
                >
                  <UIcon
                    name="i-solar-star-rings-bold-duotone"
                    class="text-2xl text-violet-400"
                  />
                </div>
                <div>
                  <h3
                    class="font-bold text-lg mb-1 group-hover:text-violet-300 transition-colors"
                  >
                    Decorations
                  </h3>
                  <p class="text-slate-400 text-sm leading-relaxed">
                    Manage avatar decorations, set pricing, link Discord SKUs,
                    and grant to users
                  </p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>

      <!-- ── Tools Section ────────────────────────────────────────────────────── -->
      <section>
        <h2
          class="text-lg font-semibold uppercase tracking-widest text-slate-500 mb-3"
        >
          Monitoring & Users
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Lobby Monitor -->
          <NuxtLink to="/admin/lobbies" class="group block">
            <UCard
              class="h-fit border border-transparent group-hover:border-emerald-500/40 transition-all group-hover:shadow-[0_0_24px_rgba(16,185,129,0.15)]"
            >
              <div class="flex items-start gap-4 p-1">
                <div
                  class="w-12 h-12 rounded-xl bg-emerald-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600/30 transition-colors"
                >
                  <UIcon
                    name="i-solar-server-minimalistic-bold-duotone"
                    class="text-2xl text-emerald-400"
                  />
                </div>
                <div>
                  <h3
                    class="font-bold text-lg mb-1 group-hover:text-emerald-300 transition-colors"
                  >
                    Lobby Monitor
                  </h3>
                  <p class="text-slate-400 text-sm leading-relaxed">
                    Monitor active game lobbies, view live Teleportal state,
                    and clean up orphaned data
                  </p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <div class="space-y-6">
            <!-- Report Viewer -->
            <UCard
              class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4"
            >
              <template #header>
                <div class="flex justify-between items-center">
                  <h2 class="text-2xl font-semibold">Reports</h2>
                  <UBadge
                    icon="i-solar-info-square-bold-duotone"
                    size="md"
                    color="info"
                    variant="solid"
                    >View and manage reported cards</UBadge
                  >
                </div>
              </template>
              <AdminReportViewer />
            </UCard>
          </div>
        </div>
      </section>
    </div>
    </ClientOnly>
  </div>
</template>
