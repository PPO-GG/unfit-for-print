# Avatar Decoration System — Design Spec

## Overview

An extensible avatar decoration system for Unfit for Print that renders visual effects (rings, sparkles, badges, etc.) around player avatars. Decorations display everywhere avatars appear — player list, game table seats, mobile strip, HUD, app header. The first decoration is a "Founder's Ring" for supporters.

## Goals

- Every avatar surface in the app can render decorations with zero per-site logic
- Adding a new decoration is just a Vue SFC + a registry entry
- Decorations have full creative freedom — each is self-contained with its own animations, colors, and effects
- No purchase flow yet — decorations are granted manually. Discord SKU integration is a future follow-up.

## Non-Goals (for this iteration)

- Discord SKU purchase flow / in-app purchases
- In-game decoration switching (equip from profile only)
- Decoration trading or gifting
- Animated decoration previews in the picker (static thumbnails are fine)

---

## Component Architecture

### `<AvatarDecoration>` Wrapper

A single Vue component that replaces all direct `<UAvatar>` / `<img>` avatar usages across the app.

**Props:**
- `decorationId` — the active decoration registry key (e.g., `'founder-ring'`), or `undefined`/`null` for no decoration. The parent is responsible for resolving this from the appropriate source (Y.Doc player data in-game, Appwrite user prefs out-of-game).
- `size` — avatar size identifier (xs, sm, md, lg, xl) passed through to both the inner avatar and the decoration component

**Behavior:**
1. If no `decorationId` (or ID not found in registry): renders the default slot (`<UAvatar>`) directly with zero overhead
2. If valid `decorationId`: looks up the decoration in the registry, dynamically imports the component, renders it as a layer around the avatar slot

```
<AvatarDecoration decorationId="founder-ring" size="sm">
  <UAvatar :src="avatarUrl" size="sm" />  ← passed as default slot
</AvatarDecoration>

<!-- Renders as: -->
<FounderRing :size="sm">
  <UAvatar :src="avatarUrl" size="sm" />
</FounderRing>
```

The parent component controls what avatar element goes in the slot and where the `decorationId` comes from — keeping the wrapper simple and context-free.

### Decoration Registry

Located at `app/utils/decorations.ts`. A plain map of decoration ID to metadata + lazy component import:

```ts
export const decorationRegistry: Record<string, DecorationEntry> = {
  'founder-ring': {
    component: () => import('~/components/decorations/FounderRing.vue'),
    name: "Founder's Ring",
    description: 'A golden swirling ring with sparkles for game supporters',
    type: 'ring',
    rarity: 'legendary',
    thumbnail: '/decorations/founder-ring-thumb.png', // static preview for picker UI
  },
}
```

**Types:**

```ts
interface DecorationEntry {
  component: () => Promise<{ default: Component }>
  name: string
  description: string
  type: string           // 'ring' | 'badge' | 'background' | 'frame' | 'particles' — open-ended
  rarity: string         // 'common' | 'rare' | 'epic' | 'legendary' — for UI treatment
  thumbnail: string      // static image path for decoration picker
}
```

### Individual Decoration Components

Each decoration is a self-contained Vue SFC in `app/components/decorations/`.

**Contract:**
- Receives avatar content via default `<slot>`
- Accepts `size` prop (xs/sm/md/lg/xl) to scale effects appropriately
- Renders its own visual layers (CSS, SVG, canvas — whatever it needs)
- Manages its own animations and cleanup (onUnmounted)
- Must not break layout — the decoration container should be the same dimensions as the avatar it wraps, with effects allowed to overflow via `overflow: visible`

### Avatar Sites to Update

All of these currently render avatars directly and need to be wrapped with `<AvatarDecoration>`:

| Component | Current Avatar | Notes |
|-----------|---------------|-------|
| `app/components/game/PlayerList.vue` | `<UAvatar>` | sm size, has host crown overlay |
| `app/components/game/GameTableSeats.vue` | `<img>` | circular, has judge badge |
| `app/components/game/GameTableHUD.vue` | `<UAvatar>` | sm size, score widget |
| `app/components/game/mobile/MobilePlayerStrip.vue` | `<img>` | 26px circular, chip layout |
| `app/components/AppHeader.vue` | `<UAvatar>` / `<img>` | mobile slideover, 40x40px |

---

## Data Model

### New Appwrite Collection: `userDecorations`

Tracks which users own which decorations. One document per user-decoration pair.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | yes | Appwrite user ID |
| `decorationId` | string | yes | Registry key (e.g., `founder-ring`) |
| `acquiredAt` | string | yes | ISO 8601 timestamp |
| `source` | string | yes | How acquired: `manual`, `discord-sku`, `promotion` |

**Indexes:** Compound index on `(userId, decorationId)` for uniqueness. Index on `userId` for fetching a user's inventory.

### Appwrite User Prefs — New Field

Add to existing preferences object:

```ts
prefs: {
  // ...existing: avatar, avatarUrl, discordUserId, name, email
  activeDecoration?: string  // decoration ID or undefined/null for none
}
```

### Y.Doc Player Data — New Field

When a player joins a game, sync `activeDecoration` into the Y.Doc player map alongside existing fields (`avatar`, `name`, `isHost`, etc.):

```ts
playerMap.set('activeDecoration', user.prefs.activeDecoration || '')
```

Other players read this from the Y.Doc to render decorations — no Appwrite calls during gameplay.

### Resolution Priority

```
In-game:  Y.Doc player.activeDecoration → decorationRegistry → lazy-load component
Out-game: Appwrite user.prefs.activeDecoration → decorationRegistry → lazy-load component
Unknown decoration ID → graceful fallback to no decoration (stale data, removed decoration)
```

---

## Founder's Ring — First Decoration

### Visual Design

- **Golden rotating gradient border** — conic gradient ring (amber/yellow/gold tones) rotating slowly (6s period)
- **Two counter-rotating sparkle orbits** — clockwise (10s) and counter-clockwise (14s) layers of sparkle star SVGs
- **Sparkle behavior** — each sparkle twinkles independently with randomized duration (1.7–2.8s) and delay. Fade in → full brightness → fade out cycle.
- **Three sparkle tones** — bright yellow (`#fde047`), warm amber (`#fbbf24`), soft white (`#fef9c3`)
- **Varied sparkle sizes** — 4px to 13px depending on avatar size
- **Ambient glow** — soft amber glow behind the ring, pulses gently (4s period)

### Size Scaling

The decoration scales sparkle count, sparkle sizes, border width, and glow intensity based on the `size` prop:

| Size | Avatar | Border | Sparkle count | Sparkle sizes |
|------|--------|--------|---------------|---------------|
| xs | ~26-32px | 2px | 4 (1 orbit) | 4-5px |
| sm | ~48px | 2px | 7 (2 orbits) | 4-7px |
| md | ~72px | 3px | 10 (2 orbits) | 5-8px |
| lg | ~120px | 3px | 11 (2 orbits) | 6-10px |
| xl | ~200px | 3px | 13 (2 orbits) | 7-13px |

### Performance

- CSS-only animations (transform, opacity) — GPU-composited, no layout thrash
- SVG sparkles are static DOM elements animated via CSS keyframes — no JS animation loop
- Sparkle positions are fixed per size (not randomized on each render) to avoid layout shifts
- At xs/sm sizes, sparkle count is reduced to keep things readable

---

## Profile Page — Decoration Picker

### Scope

The profile page (`app/pages/profile.vue`) is currently a blank stub. This design adds a decoration picker section. A full profile build-out is out of scope.

### Layout

1. **Basic profile header** — user avatar (with active decoration rendered live), display name, provider badge (Discord/Anonymous)
2. **"Your Decorations" section** — grid of owned decorations as thumbnail cards. Active decoration highlighted. Click to equip, click active to unequip.
3. **"Locked Decorations" section** — decorations the user doesn't own, shown greyed out with lock icon and acquisition hint text (e.g., "Support the game to unlock")

### Behavior

- **Equip:** Click an owned decoration → writes `activeDecoration` to Appwrite user prefs → live preview updates immediately
- **Unequip:** Click the currently active decoration → clears `activeDecoration` → preview shows bare avatar
- **Persistence:** Change is written to Appwrite prefs. Next game join will sync it into Y.Doc.

### Navigation

Add a profile link to `AppHeader.vue` navigation so the page is actually accessible.

---

## Granting Decorations (Manual for Now)

For the initial implementation, decorations are granted by directly creating documents in the `userDecorations` Appwrite collection:

```ts
{
  userId: '<appwrite-user-id>',
  decorationId: 'founder-ring',
  acquiredAt: new Date().toISOString(),
  source: 'manual'
}
```

This can be done via:
- Appwrite console directly
- A simple admin API route (if needed)
- A script

Discord SKU integration (automated purchase → entitlement → grant) is a separate future feature.

---

## Future Considerations (Not In Scope)

- **Discord SKU purchase flow** — create a durable SKU in Discord Developer Portal, handle purchase events, check entitlements via Discord API, auto-grant decorations
- **In-game decoration switching** — quick-toggle near avatar in game UI
- **Decoration preview animations** — animated thumbnails in the picker instead of static images
- **Seasonal/event decorations** — time-limited decorations with expiry dates
- **Decoration categories/filtering** — as the catalog grows, filtering by type/rarity
