<!--
  Cards & Packs — left sidebar of packs, right main pane with pack header
  and card table. Create/edit via modal.

  Currently backed by mock data via useAdminCardLibrary(). To wire up
  real Appwrite card data, swap the composable's body — the page shape
  doesn't need to change.

  Legacy card browser (real Appwrite-backed) is preserved at
  /admin/cards/browse while the new APIs are being built out.
-->
<template>
  <div>
    <AdminPageHeader
      eyebrow="Content · Library"
      title="Cards & Packs"
      :sub="loading
        ? 'Loading card library…'
        : `Edit the official card library. ${packs.length} packs · ${cards.length.toLocaleString()} cards.`"
    >
      <template #actions>
        <NuxtLink to="/admin/cards/upload" class="btn ghost">Import CSV</NuxtLink>
        <NuxtLink to="/admin/cards/browse" class="btn ghost">Legacy browser</NuxtLink>
        <button class="btn primary" @click="openEditor({ mode: 'new' })">
          <AdminIcon name="plus" /> New Card
        </button>
      </template>
    </AdminPageHeader>

    <div class="cards-layout">
      <!-- Pack sidebar -->
      <div class="panel pack-list">
        <div class="panel-header">
          <div class="panel-title pack-title">Packs</div>
          <button class="btn sm ghost"><AdminIcon name="plus" /></button>
        </div>
        <div class="pack-body">
          <button
            v-for="p in packs"
            :key="p.id"
            :class="['pack-btn', { active: p.id === activePack }]"
            @click="activePack = p.id"
          >
            <span
              class="pack-dot"
              :style="p.enabled
                ? { background: 'var(--accent-4)', boxShadow: '0 0 6px var(--accent-4)' }
                : { background: 'var(--ink-muted)' }"
            />
            <div class="pack-meta">
              <div class="pack-name">
                {{ p.name }}
                <span v-if="p.new" class="pack-new">NEW</span>
              </div>
              <div class="pack-sub">
                {{ p.count }} cards · {{ p.plays }} plays
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Main pane -->
      <div>
        <div v-if="pack" class="panel pack-header-panel">
          <div class="pack-header-inner">
            <div>
              <div class="panel-eyebrow">
                {{ pack.kind === "official" ? "Official pack" : pack.kind === "graduated" ? "Lab graduates" : "Seasonal pack" }}
              </div>
              <div class="pack-bigname">{{ pack.name }}</div>
              <div class="pack-bigsub">
                {{ pack.count }} cards · {{ pack.plays }} total plays · last edit 4d ago
              </div>
            </div>
            <div class="pack-header-actions">
              <label class="pack-toggle-label">
                <span class="pack-toggle-text">
                  {{ pack.enabled ? "Enabled" : "Disabled" }}
                </span>
                <button
                  type="button"
                  :class="['pack-toggle', { on: pack.enabled }]"
                  :aria-pressed="pack.enabled"
                  @click="togglePack(pack.id)"
                >
                  <div :class="['pack-toggle-knob', { on: pack.enabled }]" />
                </button>
              </label>
              <button class="btn ghost">Pack settings</button>
              <button v-if="!pack.enabled" class="btn primary">Publish</button>
            </div>
          </div>
        </div>

        <!-- Kind filter + search -->
        <div class="card-toolbar">
          <div class="filter-tabs">
            <button
              :class="['filter-tab', { active: kindFilter === 'all' }]"
              @click="kindFilter = 'all'"
            >
              All <span class="count">{{ packCards.length }}</span>
            </button>
            <button
              :class="['filter-tab', { active: kindFilter === 'prompt' }]"
              @click="kindFilter = 'prompt'"
            >
              Prompts <span class="count">{{ packCards.filter(c => c.kind === "prompt").length }}</span>
            </button>
            <button
              :class="['filter-tab', { active: kindFilter === 'answer' }]"
              @click="kindFilter = 'answer'"
            >
              Answers <span class="count">{{ packCards.filter(c => c.kind === "answer").length }}</span>
            </button>
          </div>
          <input v-model="search" class="input card-search" placeholder="Search this pack…" />
        </div>

        <!-- Card table -->
        <div class="panel">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 30px" />
                <th>Card</th>
                <th>Kind</th>
                <th>Plays</th>
                <th>Hot</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in filteredCards" :key="c.id">
                <td><input type="checkbox" /></td>
                <td>
                  <AdminCardMini :kind="c.kind" class="table-mini">{{ c.text }}</AdminCardMini>
                </td>
                <td>
                  <AdminKindPill :kind="c.kind">
                    {{ c.kind === "prompt" ? `PROMPT · P${c.picks || 1}` : "ANSWER" }}
                  </AdminKindPill>
                </td>
                <td><span class="col-mono">{{ c.plays.toLocaleString() }}</span></td>
                <td>
                  <div class="hot-wrap">
                    <div class="hot-track">
                      <div
                        class="hot-fill"
                        :style="{
                          width: `${c.hot * 100}%`,
                          background: c.hot > 0.85 ? 'var(--accent-4)' : c.hot > 0.7 ? 'var(--accent-3)' : 'var(--accent)',
                        }"
                      />
                    </div>
                    <span class="col-mono">{{ Math.round(c.hot * 100) }}</span>
                  </div>
                </td>
                <td><span class="col-mono added">{{ c.added }}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="btn sm ghost" @click="openEditor({ mode: 'edit', card: c })">Edit</button>
                    <button class="btn sm ghost"><AdminIcon name="more" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <AdminCardEditorModal
      v-if="editor"
      :mode="editor.mode"
      :card="editor.card"
      @close="editor = null"
      @save="onSave"
    />
  </div>
</template>

<script setup lang="ts">
import type { AdminCardRow } from "~/types/admin";

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const { packs, cards, loading, togglePack, saveCard } = useAdminCardLibrary();

const activePack = ref<string>("");
const kindFilter = ref<"all" | "prompt" | "answer">("all");
const search = ref("");

// Select the first pack once real data arrives.
watch(
  packs,
  (next) => {
    if (!activePack.value && next.length > 0) {
      activePack.value = next[0]!.id;
    } else if (activePack.value && !next.some(p => p.id === activePack.value)) {
      activePack.value = next[0]?.id ?? "";
    }
  },
  { immediate: true },
);

const pack = computed(() => packs.value.find(p => p.id === activePack.value));

const packCards = computed<AdminCardRow[]>(() =>
  cards.value.filter(c => c.pack === activePack.value),
);

const filteredCards = computed<AdminCardRow[]>(() => {
  const q = search.value.trim().toLowerCase();
  return packCards.value.filter((c) => {
    if (kindFilter.value !== "all" && c.kind !== kindFilter.value) return false;
    if (q && !c.text.toLowerCase().includes(q)) return false;
    return true;
  });
});

const editor = ref<{ mode: "new" | "edit"; card?: AdminCardRow } | null>(null);

function openEditor(state: { mode: "new" | "edit"; card?: AdminCardRow }) {
  editor.value = state;
}

async function onSave(draft: AdminCardRow) {
  await saveCard({ ...draft, pack: activePack.value });
}
</script>

<style scoped>
.cards-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 18px;
}

@media (max-width: 1100px) {
  .cards-layout { grid-template-columns: 1fr; }
}

.pack-list { align-self: start; }
.pack-title { font-size: 12px; }
.pack-body { padding: 6px; }

.pack-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-top: 2px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  color: var(--ink);
}
.pack-btn.active {
  border-color: var(--accent-3);
  background: rgba(120, 200, 255, 0.06);
}

.pack-dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
}

.pack-meta {
  flex: 1;
  min-width: 0;
}

.pack-name {
  font-family: "Archivo Black", sans-serif;
  font-size: 12px;
  text-transform: uppercase;
}

.pack-new {
  margin-left: 6px;
  font-size: 8px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--accent-2);
  color: #0d0f1a;
  letter-spacing: 0.1em;
}

.pack-sub {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
  margin-top: 2px;
  letter-spacing: 0.1em;
}

.pack-header-panel {
  padding: 18px;
  margin-bottom: 14px;
}

.pack-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
}

.pack-bigname {
  font-family: "Archivo Black", sans-serif;
  font-size: 22px;
  margin-top: 4px;
}

.pack-bigsub {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--ink-muted);
  margin-top: 4px;
  letter-spacing: 0.12em;
}

.pack-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pack-toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-dim);
}

.pack-toggle-text {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.pack-toggle {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  position: relative;
  border: 1px solid var(--line-strong);
  cursor: pointer;
  transition: background 140ms, border-color 140ms;
}
.pack-toggle.on {
  background: var(--accent-4);
  border-color: var(--accent-4);
}

.pack-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ink-dim);
  transition: left 180ms;
}
.pack-toggle-knob.on {
  left: 18px;
  background: #0d0f1a;
}

.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
  flex-wrap: wrap;
}

.card-search {
  width: 240px;
}

.table-mini {
  font-size: 12px;
  padding: 6px 10px;
}

.col-mono {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--ink-dim);
}

.col-mono.added { font-size: 10px; color: var(--ink-muted); }

.hot-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hot-track {
  width: 60px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.hot-fill {
  height: 100%;
}

.row-actions {
  display: flex;
  gap: 4px;
}
</style>
