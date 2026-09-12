# AGENTS.md

This file provides guidance to coding agents (Codex, and others that read AGENTS.md) when working with code in this repository. It is kept in sync with `CLAUDE.md`.

## Project Overview

**Unfit for Print** (https://unfit.cards) — a Cards Against Humanity-style multiplayer party game. Nuxt 4 + Vue 3, Nuxt UI v4 / Tailwind 4, Postgres via Drizzle, and Yjs CRDTs synced through a custom Teleportal WebSocket server. Package manager is **pnpm**.

## Commands

```bash
pnpm dev            # Dev server on 0.0.0.0:3000
pnpm build          # nuxt build (nitro preset: node-server)
pnpm preview        # Preview the production build
pnpm test           # Vitest (watch)
pnpm test:coverage  # Vitest run + coverage
pnpm test:db        # Server/DB suites, serial (--no-file-parallelism)
pnpm db:generate    # drizzle-kit generate (after editing server/db/schema.ts)
pnpm db:migrate     # Apply migrations to $DATABASE_URL
pnpm db:studio      # Drizzle Studio
```

Single test file / single test:

```bash
pnpm vitest run tests/composables/useSfx.test.ts
```

```bash
pnpm vitest run tests/server/db/game-engine.test.ts -t "deals a full hand"
```

```bash
pnpm typecheck      # vue-tsc --noEmit
```

There is **no linter** in this project (no ESLint/Prettier/Biome) — don't invent `pnpm lint`. `pnpm typecheck` exists but is **not currently clean**: it reports ~34 pre-existing errors, concentrated in `server/utils/` (Discord signature `Uint8Array`/`BufferSource` variance, nullable `text` columns in `seed.ts`, `User.id` not on nuxt-auth-utils' `User`) and `app/components/lobby/`. Treat it as a signal on files you touch, not a gate you can expect to pass repo-wide.

## Testing rules (important)

`tests/server/setup.ts` runs for every suite and hard-fails unless `TEST_DATABASE_URL` is set **and differs from `DATABASE_URL`**. This guardrail exists because `tests/server/db/*.test.ts` unconditionally `db.delete(...)` real tables in `beforeEach` — on 2026-08-27 that wiped the live dev database. Never repoint it at the real DB to "make tests pass".

`vitest.config.ts` loads `.env` (plain vitest, unlike `nuxt dev`, does not), so a `TEST_DATABASE_URL` line there is all that's needed — and the guardrail can now actually compare the two URLs instead of seeing an undefined `DATABASE_URL`. The disposable instance is a local container:

```bash
docker start unfit-postgres-test
```

If it needs recreating: `docker run -d --name unfit-postgres-test -p 5433:5432 -e POSTGRES_USER=unfit -e POSTGRES_PASSWORD=unfit -e POSTGRES_DB=unfit postgres:16-alpine`, then apply migrations with `DATABASE_URL=$TEST_DATABASE_URL pnpm db:migrate`.

Known-failing suites as of 2026-09-11, unrelated to card handling: `lobby-detail-admin`, `lobby-prune`, `lobby-registry` (DB), plus `BlackCard`, `UserHand`, `MobileBlackCard`, `MobileCardList`, `MobileGameLayout`, `useVoicePreview`, `userPrefsStore` — 10 files, 39 tests. Compare against that baseline rather than expecting green. `AvatarDecoration` was on this list and passes again, so treat the list as drifting: re-derive it before assuming a failure is yours.

That baseline now also lives in code, as `KNOWN_FAILING` in `vitest.config.ts`. It is skipped only when `VITEST_SKIP_KNOWN_FAILING=1`, which `.github/workflows/ci.yml` sets so a pull request gates on the 1375 tests that do pass. A local `pnpm test` still runs everything, failures included — that is deliberate, so the debt stays visible where you work. Delete entries from the list as suites are repaired; never add one to silence a new failure.

**Windows-only, added 2026-09-09 with the Vitest 4.1.11 security bump (GHSA-82fw-gwwq-j7x9):** `WhiteCard` and `AdminCardPreview` fail suite collection on Windows with `TypeError: The argument 'filename' must be a file URL object, ...`. Root cause is upstream, not app code — confirmed via `@vue/compiler-sfc`'s own `compileTemplate()` that neither component's plain `<img src="/img/...">` markup ever gets turned into an import, and via Vite's debug log that Vite itself resolves the asset fine; the crash is Vitest 4's new `vm.runInContext`-based module evaluator mishandling a non-drive-letter `file://` URL when it tries to load that resolved asset as a module. Matches a Vitest PR closed without merging (vitest-dev/vitest#9310, "Use `meta.url` as the argument to `createRequire()`... can cause bugs on Windows"). Does not reproduce on Linux (a non-drive-letter `file://` URL is valid POSIX) and does not affect this project's CI, which runs on `ubuntu-latest` (`.github/workflows/ci.yml`). Does not affect the built app (`pnpm build` is clean). If you're on Windows, expect these two on top of the baseline above.

The same setup file stubs Nitro/H3 globals (`defineEventHandler`, `createError`, …) so server route modules can be imported directly in unit tests without a running server.

## Architecture

### Dual persistence — the central idea

Two stores, split by lifetime:

- **Ephemeral game state → Yjs `Y.Doc`**, held in memory by `teleportal-server/` and synced over WebSocket. Every in-game mutation (play card, reveal, judge, next round, score) runs **client-side** and replicates via CRDT. Nothing is persisted; docs are GC'd after the last client disconnects. State loss on restart is by design.
- **Durable metadata → Postgres** (Drizzle, `server/db/schema.ts`): users, lobbies, players, white/black cards + packs, submissions, reports, decorations. Reached only through Nitro routes in `server/api/`.

Consequence: **game mutations must go through Yjs, not new API routes.** The only server calls during a game are `POST /api/game/start` (initial deck fetch), `POST /api/game/draw-cards` (deck replenishment), and `POST /api/cards/resolve` (per-client white-card text lookup) — none of them mutate game state.

### Lifecycle

1. **Lobby phase** — Postgres holds lobby/player rows for discovery and joins (`/api/lobby/*`).
2. **Game phase** — `useLobbyDoc()` connects the Y.Doc; `useYjsGameEngine()` runs all rules; `useLobbyReactive()` bridges Y types into Vue refs.

### Composable layers (this is where the logic lives — pages are thin)

| Composable | Role |
|---|---|
| `useLobbyDoc.ts` | Y.Doc factory + Teleportal provider. Owns `DOC_KEYS` (`meta`, `settings`, `gameState`, `cards`, `hands`, `players`, `chat`) — **import these, never hardcode map names**. Exposes typed `getX()` accessors. |
| `useLobbyReactive.ts` | Observes Y.Maps and exposes Vue refs. Values are stored as **JSON strings** in Y.Maps and parsed here. |
| `useCardTexts.ts` | Per-client card-text resolution: batch-fetches the white and black texts this client displays from `/api/cards/resolve` and caches them locally. Never writes back to the doc. |
| `useYjsGameEngine.ts` | The game rules. Each action reads state → validates phase/actor → mutates inside `doc.transact()`. Public API: `playCard`, `revealCard`, `selectWinner`, `nextRound`, `skipPlayer`, `skipJudge`, `setReadAloud`, `convertToPlayer`, `resetGame`, `markReturnedToLobby`, `handlePlayerLeave`, `replenishWhiteDeck`, `drawCards`. |
| `useLobbyMutations.ts` | Lobby-level Y.Doc writes: `initializeLobby`, `addPlayer`, `removePlayer`, `setPlayerReady`, `updateSettings`, `startGame`. (Lobby status is written by the engine directly — `getMeta().set("status", …)` at three sites.) |
| `useLobby.ts` | Composes all of the above + Postgres-backed lobby discovery. The façade most UI uses. |

Game phases (`app/types/game.d.ts`): `waiting → submitting → submitting-complete → judging → roundEnd → complete`.

Two Y.Doc quirks worth knowing before editing the engine:

- **No card text is stored in the Y.Doc.** The doc carries card *ids* plus one `blackPicks` map (black card id → pick count) in the `cards` map. `pick` has to be there because `nextRound` runs inside a `transact()` and its eligibility loop reads it for candidates it may skip — that is the one lookup that cannot be async. Everything else is resolved per client by `useCardTexts.ts`: `collectVisibleCardIds` for white ids, the current `blackCard.id` for black, both through `POST /api/cards/resolve` (which queries one table per call, hence the split). `useLobby` swaps the result in as `reactive.cardTexts` and overlays `blackCard.text` via `withResolvedBlackText`, so **no component needed changing** — they still read `cardTexts[id]?.text` and `blackCard.text`.
- **Legacy doc support is deliberate, not vestigial.** Docs created before this change embedded texts under `cardTexts` and chunked `cardTexts_0…N` keys. `mergeCardTextKeys()` in `app/utils/cardTexts.ts` is the single reader for those keys, `readBlackPicks` falls back to the `pick` values inside them, and `withResolvedBlackText` prefers an embedded text when present — so a game in flight across a deploy keeps working. That shared reader also exists because three hand-rolled copies of the merge once hid replenished cards from `UserHand` while the judging table looked fine.
- **Map values are JSON strings**, so writes need `JSON.stringify` and reads go through the `safeParseJson` helpers. This also means Yjs is acting as a sync channel, not a merge engine — two clients writing different fields of the same object clobber each other rather than merging. The phase guards plus `transact()` are what keep that safe, so don't loosen them.

### Server (`server/`)

~80 Nitro routes, deliberately narrow: auth, lobby CRUD/discovery, card queries, TTS proxies (`speak`, `openai-speak`, `google-speak`, `kokoro-speak`), Discord webhooks, bots, reports, and `/api/admin/*`.

- DB handle: `useDb()` from `server/db/client.ts` (lazy `pg` Pool + Drizzle singleton).
- Auth guards: `server/utils/session.ts` — `requireAuth`, `requirePlayerInLobby`, `requireHost`. Auth accepts **either** a Nuxt session cookie **or** a `Bearer` Discord-Activity token (`server/utils/activityToken.ts`).
- `server/plugins/lobby-sweeper.ts` prunes stale lobbies every 30 min; it self-disables under `VITEST`/`NODE_ENV=test`.
- **Lobby rows are reconciled server-side, not by the host's browser.** The Y.Doc is authoritative for lobby state, but Postgres is what the public browser filters on. Those columns used to be mirrored by watchers in `app/pages/game/[code].vue` that ran **only in the host's tab**, so a host closing their tab stranded a lobby as `playing` until the sweeper caught it hours later, and a mid-game rename never reached Postgres at all. Now `/api/lobby/list` pulls Teleportal's `/lobbies/summary` and applies `planLobbyReconciliation` (`server/utils/reconcileLobbies.ts`) before filtering. It is deliberately conservative — a lobby with no live doc is left alone (absence is not evidence; pruning is `pruneLobbies`' job), a field the summary omits is left alone, and an unreachable Teleportal fails open rather than erroring the browser.
- **Deploy ordering:** `status`, `lobbyName` and `isPrivate` in `/lobbies/summary` were added in `teleportal-server/`, which deploys separately from the web app. The reconciliation skips fields the summary does not carry, so shipping the web app first is safe — it simply reconciles nothing until Teleportal catches up.
- `playerType` is mirrored by `POST /api/players/convert`, fired by the engine after `convertToPlayer` succeeds. You may deal yourself in; only the host may deal in someone else.
- `server/utils/game-engine.ts` is *not* a server-side game engine — it only fetches/shuffles card IDs for `game/start.post.ts`.

### Discord Activity

The app runs both as a website and as a Discord Activity (embedded iframe). Client requests should go through `$activityFetch` (`app/plugins/activity-fetch.client.ts`), which injects Activity auth headers from `useAuthHeaders()` when running inside Discord. Middleware `discord-csp.ts` / `discord-redirect.ts` and `app/middleware/discord-activity.global.ts` handle the embedded context.

### `teleportal-server/`

Standalone ~660-line Yjs server with its own `package.json`, Dockerfile, and lockfile — **not** part of the pnpm workspace. No persistence, no storage backend, no auth (knowing the lobby code is the access control). Origin-allowlisted. HTTP endpoints: `/health`, `/status`, `/lobbies/summary`, `POST /gc` (the admin `/api/admin/teleportal/*` routes proxy these; base URL derived from the WS config by `server/utils/teleportal.ts`).

## Conventions

- Feature logic goes in `app/composables/`; pages are orchestrators. `app/pages/game/[code].vue` is the main game room and wires composables together — resist adding rules there.
- Components auto-register **without prefixes** (`~/components/game`, `/lobby`, `/decorations` are flattened in `nuxt.config.ts`), so component names must stay globally unique.
- Theming lives in `app/app.config.ts` (Nuxt UI color aliases + slot overrides; dark-first, slate neutrals). Card/lobby CSS in `app/assets/css/lobby.css`.
- i18n: 9 locales in `i18n/locales/`, strategy `no_prefix`. Add new user-facing strings to `en.json` at minimum.
- Runtime config is env-driven (`NUXT_*`); see `.env.example`. Anything under `runtimeConfig.public` ships to the client bundle.
- Commits follow **Conventional Commits** — enforced by commitlint in CI and consumed by release-please (`feat`, `fix`, `perf`, `refactor`, `docs` are user-visible in the changelog). Scopes in use: `web`, `server`, `bot`. Do not hand-edit `CHANGELOG.md` or `package.json` version — release-please owns them.
- All work happens on **`main`**; `dev` no longer exists.

## Legacy vestiges

The project migrated off Appwrite to Postgres, but the **`$id` wire format is still live**, not dead code: routes like `server/api/admin/decorations/list.get.ts` explicitly map Drizzle's `id` → `$id` in their response, and `app/types/player.d.ts` / `decoration.d.ts` plus the admin components read it. Don't "clean up" `$id` piecemeal — it's an API contract shared by routes, types, and components, and renaming it is an all-at-once refactor.

Genuinely dead Appwrite naming has been removed (`app/utils/resolveId.ts`). A stale "Appwrite Registry" comment in `useLobby.ts` still labels what is now Postgres-backed discovery.

`AGENTS.md` is the tracked copy of this document; `CLAUDE.md` is the same content with a different header and is gitignored (line 27), so it stays local per-developer. If you keep both, change them together.
