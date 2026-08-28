import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true })
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
  text: text("text").notNull(),
  pack: text("pack"),
  active: boolean("active").notNull().default(true),
  timesPlayed: integer("times_played").notNull().default(0),
  timesWon: integer("times_won").notNull().default(0),
});

export const blackCards = pgTable("black_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  pack: text("pack"),
  active: boolean("active").notNull().default(true),
  pick: integer("pick").notNull().default(1),
  timesPlayed: integer("times_played").notNull().default(0),
});

export const defaultCardPacks = pgTable("default_card_packs", {
  pack: text("pack").primaryKey(),
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
