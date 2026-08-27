# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Unfit for Print** is a Cards Against Humanity-inspired multiplayer party game at https://unfit.cards. Built with Nuxt 4 + Vue 3 Composition API, Appwrite (self-hosted BaaS), and Yjs CRDTs for real-time game sync via a custom Teleportal WebSocket server.

## Commands

```bash
pnpm dev                  # Dev server (binds 0.0.0.0)
pnpm build                # Production build (8GB Node heap)
pnpm preview              # Preview production build
pnpm test                 # Run vitest
pnpm test:gameplay        # Integration test (60s timeout)
pnpm schema:sync          # Sync Appwrite database schema
```

## Architecture

### Dual Persistence Model

- **Ephemeral (game state)**: Yjs Y.Doc stored in-memory on `teleportal-server/`. All in-game mutations (play card, judge, score) happen client-side via CRDTs that sync over WebSocket. No server persistence — state is lost on restart by design.
- **Permanent (metadata)**: Appwrite for users, card decks, lobby discovery, reports, and auth. Server API routes (`server/api/`) interact with Appwrite via admin SDK.

### Real-Time Flow

1. **Lobby phase**: Appwrite Realtime for lobby metadata (players joining, status changes)
2. **Game phase**: Switches to Teleportal Y.Doc — `useLobbyDoc()` connects, `useYjsGameEngine()` drives all game logic client-side, `useLobbyReactive()` provides Vue reactivity bindings

### Key Composables (the real logic lives here)

- `useLobby.ts` — Y.Doc registry + Appwrite lobby discovery (~930 lines)
- `useYjsGameEngine.ts` — Client game engine replacing ~10 server routes (~920 lines)
- `useLobbyDoc.ts` — Teleportal Y.Doc provider
- `useLobbyReactive.ts` — Vue reactivity bindings to Y.Doc state
- `useLobbyMutations.ts` — Game state mutations

### Server (`server/`)

Nitro API routes are minimal — handle auth, initial card draws, chat, and admin. The server admin SDK singleton is in `server/utils/appwrite.ts`. Auth guard: `server/utils/requirePlayer.ts`.

### Teleportal Server (`teleportal-server/`)

Standalone Yjs document server (~800 lines). Runs independently, has its own `package.json` and Dockerfile. Auto-GCs documents 60s after last client disconnect.

### Main Game Page

`app/pages/game/[code].vue` (~1035 lines) is the central game room — it's a thin orchestrator that wires together the composables above.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Nuxt 4 + Vue 3 Composition API |
| UI | @nuxt/ui v4 (125+ components), Tailwind CSS 4 |
| State | Pinia 3 (persisted) + Yjs CRDT |
| Real-time | Yjs + Teleportal WebSocket |
| Backend | Appwrite (self-hosted at api.ppo.gg) + Nitro |
| Auth | Discord OAuth2 + Anonymous sessions |
| Hosting | Cloudflare Workers |
| i18n | @nuxtjs/i18n (8 languages) |
| Testing | Vitest + JSDOM |
| Package mgr | pnpm |

## Cloudflare Workers Compatibility

Node polyfill shims exist at `server/utils/fetch-shim.mjs` and `server/utils/json-bigint-shim.mjs` — these are aliased in `nuxt.config.ts` for Cloudflare Workers compatibility with node-appwrite.

## Database

Schema defined in `appwrite.json`. Key collections: lobby, player, whiteCard, blackCard, gameCards, gameChat, gameSettings, submission, reports. Collection IDs are in `nuxt.config.ts` runtime config and `wrangler.toml`.

## Conventions

- Feature logic lives in composables, not pages. Pages are thin wrappers.
- Game mutations go through Yjs, not server API calls.
- Theming is in `app/app.config.ts` (Nuxt UI slots/variants, dark-mode default with slate palette).
- Translations in `i18n/locales/` (8 JSON files). Strategy: `no_prefix`.
- Main branch for PRs: `dev`.