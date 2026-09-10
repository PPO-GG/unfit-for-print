import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { IssueContext } from "~/types/issue";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordUserId: text("discord_user_id").unique(),
  isGuest: boolean("is_guest").notNull().default(true),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  activeDecoration: text("active_decoration"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lobbies = pgTable("lobbies", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  hostUserId: uuid("host_user_id")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["waiting", "playing", "complete"] })
    .notNull()
    .default("waiting"),
  lobbyName: text("lobby_name"),
  discordInstanceId: text("discord_instance_id"),
  discordChannelId: text("discord_channel_id"),
  vcOnly: boolean("vc_only").notNull().default(false),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Lobby join passwords, kept in their own table rather than on `lobbies`.
 *
 * Eight routes select whole lobby rows (`select()` with no column list, plus
 * `.returning()` on create and join), so a hash on that row would ship to every
 * client through any of them — and through the next route someone writes. A
 * separate table cannot leak by accident: no existing query touches it.
 *
 * Cascades with the lobby, so a deleted lobby cannot strand its secret.
 */
export const lobbyPasswords = pgTable("lobby_passwords", {
  lobbyId: uuid("lobby_id")
    .primaryKey()
    .references(() => lobbies.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  lobbyId: uuid("lobby_id")
    .notNull()
    .references(() => lobbies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatar: text("avatar"),
  isHost: boolean("is_host").notNull().default(false),
  playerType: text("player_type", { enum: ["spectator", "player", "bot"] })
    .notNull()
    .default("player"),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const whiteCards = pgTable("white_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text"),
  pack: text("pack"),
  active: boolean("active").notNull().default(true),
  timesPlayed: integer("times_played").notNull().default(0),
  timesWon: integer("times_won").notNull().default(0),
  imageKey: text("image_key"),
  imageFormat: text("image_format"),
  attachment: jsonb("attachment").$type<Record<string, unknown> | null>(),
});

export const blackCards = pgTable("black_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text"),
  pack: text("pack"),
  active: boolean("active").notNull().default(true),
  pick: integer("pick").notNull().default(1),
  timesPlayed: integer("times_played").notNull().default(0),
  timesSkipped: integer("times_skipped").notNull().default(0),
  imageKey: text("image_key"),
  imageFormat: text("image_format"),
  attachment: jsonb("attachment").$type<Record<string, unknown> | null>(),
});

export const defaultCardPacks = pgTable("default_card_packs", {
  pack: text("pack").primaryKey(),
});

/**
 * Per-pack metadata. Deliberately has **no foreign key** to the card tables:
 * a pack exists because cards point at it, and this row is optional
 * decoration on top. Packs with no row keep working exactly as before, which
 * is also why nothing here is required beyond the key itself.
 *
 * `color` is stored ahead of any reader: /api/cards/resolve already returns
 * each card's `pack`, so a future per-pack card treatment (foil, pattern,
 * accent) is a pure rendering change with no migration behind it.
 */
export const cardPacks = pgTable("card_packs", {
  pack: text("pack").primaryKey(),
  displayName: text("display_name"),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  official: boolean("official").notNull().default(false),
  nsfw: boolean("nsfw").notNull().default(false),
  /**
   * The brand/series a pack belongs to (e.g. "Cards Against Humanity",
   * "Unfit for Print") — editable, and distinct from `displayName`. Most
   * packs never got a row here, so the admin UI still falls back to
   * `commonPackPrefix`/`splitPackName`'s guess from the raw pack name when
   * this is null; an explicit value always wins over that guess.
   */
  series: text("series"),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  submitterId: uuid("submitter_id")
    .notNull()
    .references(() => users.id),
  submitterName: text("submitter_name").notNull(),
  cardType: text("card_type", { enum: ["white", "black"] }).notNull(),
  text: text("text").notNull(),
  pick: integer("pick"),
  upvotes: integer("upvotes").notNull().default(0),
  upvoterIds: text("upvoter_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id").notNull(),
  cardType: text("card_type", { enum: ["white", "black"] }).notNull(),
  reason: text("reason").notNull(),
  reportedBy: uuid("reported_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const decorations = pgTable("decorations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  rarity: text("rarity").notNull(),
  category: text("category"),
  enabled: boolean("enabled").notNull().default(true),
  freeForAll: boolean("free_for_all").notNull().default(false),
  discordSkuId: text("discord_sku_id"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  imageKey: text("image_key"),
  imageFormat: text("image_format"),
  attachment: jsonb("attachment").$type<Record<string, unknown> | null>(),
});

export const userDecorations = pgTable(
  "user_decorations",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    decorationId: text("decoration_id")
      .notNull()
      .references(() => decorations.id, { onDelete: "cascade" }),
    acquiredAt: timestamp("acquired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: text("source").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.decorationId] })],
);

// Issue tracking. Two tables rather than one so "alert me once per distinct
// problem" is a property of a row rather than a query: the webhook fires on
// group creation, and the admin page lists ~12 problems instead of 4,000
// events.
export const issueGroups = pgTable(
  "issue_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fingerprint: text("fingerprint").notNull().unique(),
    kind: text("kind", {
      enum: [
        "client-error",
        "api-error",
        "player-report",
        "anomaly",
        "server-error",
      ],
    }).notNull(),
    title: text("title").notNull(),
    status: text("status", { enum: ["open", "resolved", "muted"] })
      .notNull()
      .default("open"),
    eventCount: integer("event_count").notNull().default(0),
    firstSeen: timestamp("first_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Written once at group creation, never updated — it answers "which
     *  release introduced this". */
    firstAppVersion: text("first_app_version"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (table) => [index("issue_groups_last_seen_idx").on(table.lastSeen.desc())],
);

export const issueEvents = pgTable(
  "issue_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => issueGroups.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    stack: text("stack"),
    // Plain text, NOT a reference to lobbies.id. The sweeper prunes lobbies;
    // an issue must outlive the lobby it happened in, and a cascade delete
    // would erase the evidence.
    lobbyCode: text("lobby_code"),
    // Bare uuid with no .references(), unlike reports.reportedBy. Ingest is
    // unauthenticated, so an FK turns a stale id into a 500 on the one
    // endpoint that must never fail loudly.
    userId: uuid("user_id"),
    appVersion: text("app_version").notNull(),
    platform: text("platform"),
    route: text("route"),
    context: jsonb("context").$type<IssueContext | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("issue_events_group_created_idx").on(
      table.groupId,
      table.createdAt.desc(),
    ),
    index("issue_events_lobby_code_idx").on(table.lobbyCode),
  ],
);
