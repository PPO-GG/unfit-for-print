<script setup lang="ts">
useHead({ title: "Changelog · Unfit for Print" });

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangelogEntry {
  scope?: string;
  text: string;
  commitUrl?: string;
  commitHash?: string;
}

interface ChangelogSection {
  emoji: string;
  label: string;
  color: string;
  dotColor: string;
  bgColor: string;
  borderColor: string;
  entries: ChangelogEntry[];
}

interface ParsedVersion {
  tag: string;
  title: string;
  date: string;
  sections: ChangelogSection[];
  isBreaking: boolean;
  totalFeatures: number;
  totalFixes: number;
}

// ─── Category registry ────────────────────────────────────────────────────────

const CATEGORIES: Record<
  string,
  {
    label: string;
    color: string;
    dotColor: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  "✨": {
    label: "Features",
    color: "text-violet-300",
    dotColor: "bg-violet-400",
    bgColor: "bg-violet-500/8",
    borderColor: "border-violet-500/40",
  },
  "🐛": {
    label: "Bug Fixes",
    color: "text-rose-300",
    dotColor: "bg-rose-400",
    bgColor: "bg-rose-500/8",
    borderColor: "border-rose-500/40",
  },
  "♻️": {
    label: "Refactors",
    color: "text-sky-300",
    dotColor: "bg-sky-400",
    bgColor: "bg-sky-500/8",
    borderColor: "border-sky-500/40",
  },
  "⚡": {
    label: "Performance",
    color: "text-amber-300",
    dotColor: "bg-amber-400",
    bgColor: "bg-amber-500/8",
    borderColor: "border-amber-500/40",
  },
  "⚠": {
    label: "Breaking Changes",
    color: "text-orange-300",
    dotColor: "bg-orange-400",
    bgColor: "bg-orange-500/8",
    borderColor: "border-orange-500/40",
  },
  "📝": {
    label: "Documentation",
    color: "text-slate-300",
    dotColor: "bg-slate-400",
    bgColor: "bg-slate-500/8",
    borderColor: "border-slate-500/40",
  },
};

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseMarkdown(markdown: string): ChangelogSection[] {
  if (!markdown?.trim()) return [];
  const sections: ChangelogSection[] = [];

  // Split on h3 headings
  const parts = markdown.split(/^###\s+/m).filter(Boolean);

  for (const part of parts) {
    const lines = part.split("\n");
    const heading = lines[0]?.trim() ?? "";

    // Match one of our known emojis
    let matched: (typeof CATEGORIES)[string] | null = null;
    let emoji = "";
    for (const [e, meta] of Object.entries(CATEGORIES)) {
      if (heading.includes(e)) {
        matched = meta;
        emoji = e;
        break;
      }
    }
    if (!matched) continue;

    const entries: ChangelogEntry[] = [];

    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      if (!line.startsWith("*") && !line.startsWith("-")) continue;

      // Strip leading bullet
      let content = line.replace(/^[*-]\s*/, "");

      // ── Scope extraction ────────────────────────────────────────────────
      // ungh.cc returns scope as a literal backslash-n prefix:
      //   "\\ngame: description (hash)"
      // Some older entries may use markdown bold: "**scope:** description"
      let scope = "";
      const escapedNlScope = content.match(/^\\n([^:]+):\s*(.*)/s);
      const boldScope = content.match(/^\*\*([^*]+)\*\*:\s*(.*)/s);
      if (escapedNlScope) {
        scope = escapedNlScope[1]!.trim();
        content = escapedNlScope[2]!;
      } else if (boldScope) {
        scope = boldScope[1]!.trim();
        content = boldScope[2]!;
      }

      // ── Commit hash extraction ───────────────────────────────────────────
      // Format A: markdown link  ([abc1234](url))
      // Format B: bare hash      (abc1234)  at end of line
      let commitUrl = "";
      let commitHash = "";
      const mdLink = content.match(/\s*\(?(\[([a-f0-9]{7,})\]\(([^)]+)\))\)?/);
      const bareHash = content.match(/\s*\(([a-f0-9]{7,})\)\s*$/);
      if (mdLink) {
        commitHash = mdLink[2]!;
        commitUrl = mdLink[3]!;
        content = content.replace(mdLink[0]!, "").trim();
      } else if (bareHash) {
        commitHash = bareHash[1]!;
        commitUrl = `https://github.com/PPO-GG/unfit-for-print/commit/${commitHash}`;
        content = content.replace(bareHash[0]!, "").trim();
      }

      content = content.replace(/\s*\)$/, "").trim();

      if (content || scope) {
        entries.push({ scope, text: content, commitUrl, commitHash });
      }
    }

    if (entries.length > 0) {
      sections.push({
        emoji,
        label: matched.label,
        color: matched.color,
        dotColor: matched.dotColor,
        bgColor: matched.bgColor,
        borderColor: matched.borderColor,
        entries,
      });
    }
  }

  return sections;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// Lightweight inline markdown → HTML (safe: no user input, all content from
// the GitHub releases API for our own repo).
function renderInline(text: string): string {
  return (
    text
      // **bold**
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // *italic*  (single asterisk, not adjacent to word boundaries to avoid false positives)
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      // [label](url)
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>',
      )
  );
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

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
    }): ParsedVersion[] => {
      return data.releases.map((release) => {
        const sections = parseMarkdown(release.markdown);
        const isBreaking = sections.some((s) => s.emoji === "⚠");
        const totalFeatures =
          sections.find((s) => s.emoji === "✨")?.entries.length ?? 0;
        const totalFixes =
          sections.find((s) => s.emoji === "🐛")?.entries.length ?? 0;
        return {
          tag: release.tag,
          title: release.name || release.tag,
          date: release.publishedAt,
          sections,
          isBreaking,
          totalFeatures,
          totalFixes,
        };
      });
    },
  },
);

const latestVersion = computed(() => versions.value?.[0] ?? null);
const isPending = computed(() => status.value === "pending");

// Aggregate stats for left panel
const latestStats = computed(() => {
  const v = latestVersion.value;
  if (!v) return null;
  return {
    features: v.totalFeatures,
    fixes: v.totalFixes,
    sections: v.sections.length,
    breaking: v.isBreaking,
  };
});
</script>

<template>
  <div>
    <!-- ── Left: fixed hero panel (desktop) ─────────────────────────────────── -->
    <aside
      class="hidden xl:flex flex-col"
      :style="{
        position: 'fixed',
        top: 'calc(4rem + 0.5rem)',
        left: 0,
        bottom: 0,
        width: '420px',
        padding: '3rem 2.5rem 2rem 3rem',
        zIndex: 10,
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }"
    >
      <!-- Logo + badge -->
      <div class="flex items-center gap-3 mb-6">
        <img
          src="/img/ufp2.svg"
          alt="Unfit for Print"
          class="h-9 w-auto shrink-0 drop-shadow-lg"
        />
        <UBadge
          v-if="latestVersion?.tag"
          :label="latestVersion.tag"
          color="primary"
          variant="subtle"
          size="md"
          class="font-mono tracking-wide"
        />
        <USkeleton v-else-if="isPending" class="h-6 w-20 rounded-full" />
      </div>

      <!-- Title -->
      <h1
        class="text-5xl font-bold tracking-tight text-highlighted leading-none mb-3"
      >
        Changelog
      </h1>
      <p class="text-base text-muted leading-relaxed mb-6 max-w-xs">
        Every feature, fix, and improvement shipped to Unfit for Print.
      </p>

      <!-- GitHub link -->
      <UButton
        to="https://github.com/PPO-GG/unfit-for-print"
        target="_blank"
        icon="i-simple-icons-github"
        variant="ghost"
        color="neutral"
        size="md"
        class="-ms-2.5 mb-8"
      >
        View on GitHub
      </UButton>

      <!-- Latest release stat chips -->
      <template v-if="latestStats && !isPending">
        <p
          class="text-xs font-mono text-primary uppercase tracking-widest mb-3 opacity-70"
        >
          Latest release
        </p>
        <div class="flex flex-wrap gap-2 mb-1">
          <span
            v-if="latestStats.features > 0"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30"
          >
            <span class="text-sm leading-none">✨</span>
            {{ latestStats.features }} feature{{
              latestStats.features !== 1 ? "s" : ""
            }}
          </span>
          <span
            v-if="latestStats.fixes > 0"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30"
          >
            <span class="text-sm leading-none">🐛</span>
            {{ latestStats.fixes }} fix{{ latestStats.fixes !== 1 ? "es" : "" }}
          </span>
          <span
            v-if="latestStats.breaking"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30"
          >
            <span class="text-sm leading-none">⚠️</span>
            Breaking
          </span>
        </div>
        <p class="text-xs text-muted mt-2 font-mono">
          {{ formatDate(latestVersion!.date) }}
        </p>
      </template>
      <div v-else-if="isPending" class="space-y-2">
        <USkeleton class="h-5 w-32 rounded-lg" />
        <USkeleton class="h-5 w-24 rounded-lg" />
      </div>
    </aside>

    <!-- ── Mobile hero ──────────────────────────────────────────────────────── -->
    <div class="xl:hidden border-b border-default px-4 sm:px-6 py-10">
      <div class="flex items-center gap-3 mb-4">
        <img
          src="/img/ufp2.svg"
          alt="Unfit for Print"
          class="h-8 w-auto shrink-0"
        />
        <UBadge
          v-if="latestVersion?.tag"
          :label="latestVersion.tag"
          color="primary"
          variant="subtle"
          size="md"
          class="font-mono"
        />
      </div>
      <h1 class="text-4xl font-bold tracking-tight text-highlighted mb-2">
        Changelog
      </h1>
      <p class="text-muted mb-4">Every feature, fix, and improvement.</p>
      <UButton
        to="https://github.com/PPO-GG/unfit-for-print"
        target="_blank"
        icon="i-simple-icons-github"
        variant="ghost"
        color="neutral"
        size="sm"
        class="-ms-2"
      >
        GitHub
      </UButton>
    </div>

    <!-- ── Right: changelog scroll ──────────────────────────────────────────── -->
    <section class="xl:ml-[420px] px-4 sm:px-6 xl:px-14 py-16 sm:py-24">
      <!-- Loading skeletons -->
      <div v-if="isPending" class="space-y-16 max-w-2xl">
        <div v-for="i in 3" :key="i" class="space-y-6">
          <div class="flex items-center gap-4">
            <USkeleton class="h-5 w-20 rounded-full" />
            <USkeleton class="h-4 w-28 rounded" />
          </div>
          <USkeleton class="h-9 w-40 rounded-lg" />
          <div class="space-y-3">
            <USkeleton class="h-4 w-full rounded" />
            <USkeleton class="h-4 w-5/6 rounded" />
            <USkeleton class="h-4 w-4/6 rounded" />
          </div>
        </div>
      </div>

      <!-- Actual changelog -->
      <div v-else class="relative max-w-2xl">
        <!-- Timeline: vertical line -->
        <div
          class="absolute left-[7px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/60 via-violet-500/20 to-transparent pointer-events-none"
        />

        <div class="space-y-16">
          <article
            v-for="(version, idx) in versions"
            :key="version.tag"
            class="relative pl-10"
          >
            <!-- Timeline dot -->
            <div
              :class="[
                'absolute left-0 top-[0.35rem] w-3.5 h-3.5 rounded-full ring-2 ring-offset-2 ring-offset-black/0',
                idx === 0
                  ? 'bg-amber-400 ring-amber-400/40 shadow-[0_0_12px_2px_rgba(251,191,36,0.3)]'
                  : 'bg-violet-500 ring-violet-500/30',
              ]"
            />

            <!-- Version header -->
            <div class="flex flex-wrap items-center gap-2.5 mb-3">
              <span
                :class="[
                  'font-mono text-xs font-semibold px-2.5 py-1 rounded-lg ring-1',
                  idx === 0
                    ? 'bg-amber-400/15 text-amber-300 ring-amber-400/30'
                    : 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
                ]"
              >
                {{ version.tag }}
              </span>

              <span
                v-if="idx === 0"
                class="text-[10px] font-bold uppercase tracking-widest text-amber-400/80 border border-amber-400/30 rounded px-1.5 py-0.5"
              >
                Latest
              </span>

              <span
                v-if="version.isBreaking"
                class="text-[10px] font-bold uppercase tracking-widest text-orange-400/80 border border-orange-400/30 rounded px-1.5 py-0.5"
              >
                ⚠ Breaking
              </span>

              <span class="text-xs text-muted font-mono ml-auto">
                {{ formatDate(version.date) }}
              </span>
            </div>

            <!-- Version title -->
            <h2 class="text-2xl font-bold tracking-tight text-highlighted mb-5">
              {{ version.title !== version.tag ? version.title : "" }}
            </h2>

            <!-- Empty release (no parsed sections) -->
            <p
              v-if="version.sections.length === 0"
              class="text-sm text-muted italic"
            >
              No details available for this release.
            </p>

            <!-- Category sections -->
            <div class="space-y-4">
              <div
                v-for="section in version.sections"
                :key="section.label"
                :class="[
                  'rounded-xl border-l-2 pl-4 pr-4 py-3',
                  section.bgColor,
                  section.borderColor,
                ]"
              >
                <!-- Section header -->
                <div class="flex items-center gap-2 mb-2.5">
                  <span class="text-sm leading-none">{{ section.emoji }}</span>
                  <span
                    :class="[
                      'text-xs font-bold uppercase tracking-widest',
                      section.color,
                    ]"
                  >
                    {{ section.label }}
                  </span>
                  <span
                    :class="[
                      'ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded',
                      section.color,
                      'opacity-60',
                    ]"
                  >
                    {{ section.entries.length }}
                  </span>
                </div>

                <!-- Entries -->
                <ul class="space-y-1.5">
                  <li
                    v-for="(entry, ei) in section.entries"
                    :key="ei"
                    class="flex items-start justify-between gap-3 text-sm"
                  >
                    <!-- Inline scope + text -->
                    <span class="text-default/80 leading-relaxed flex-1">
                      <span
                        v-if="entry.scope"
                        :class="['font-bold font-mono', section.color]"
                        >{{ entry.scope }}:&nbsp;</span
                      ><span v-html="renderInline(entry.text)" />
                    </span>

                    <!-- Commit hash link -->
                    <a
                      v-if="entry.commitUrl"
                      :href="entry.commitUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="shrink-0 mt-0.5 font-mono text-[10px] text-muted hover:text-primary transition-colors"
                      :title="`View commit ${entry.commitHash}`"
                    >
                      {{ entry.commitHash?.slice(0, 7) }}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Hide scrollbar on the fixed left panel */
aside::-webkit-scrollbar {
  display: none;
}
</style>
