// Replays 0012_pack_ids.sql inside a scratch schema built in the
// pre-migration shape. The test database itself is already migrated, so this
// is the only place the backfill rules — naming, collisions, defaults,
// card repointing — can be exercised against old-shaped data.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const SCHEMA = "mig_pack_ids";
// `import.meta.url` is assigned to a variable before use rather than passed
// directly to `new URL(...)`: Vite statically detects the inline
// `new URL('relative', import.meta.url)` form as an asset reference and
// rewrites it to resolve against the dev server origin instead of the real
// file path, which breaks this test under `pnpm vitest`.
const here = import.meta.url;
const sqlPath = fileURLToPath(
  new URL("../../../server/db/migrations/0012_pack_ids.sql", here),
);
let client: Client;

const rows = async (sql: string) => (await client.query(sql)).rows;

beforeAll(async () => {
  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await client.query(`CREATE SCHEMA ${SCHEMA}`);
  await client.query(`SET search_path TO ${SCHEMA}`);
  await client.query(`
    CREATE TABLE card_packs (
      pack text PRIMARY KEY, display_name text, description text, icon text, color text,
      sort_order integer NOT NULL DEFAULT 0, official boolean NOT NULL DEFAULT false,
      nsfw boolean NOT NULL DEFAULT false, series text
    );
    CREATE TABLE default_card_packs (pack text PRIMARY KEY);
    CREATE TABLE white_cards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), text text, pack text);
    CREATE TABLE black_cards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), text text, pack text);

    INSERT INTO white_cards (text, pack) VALUES
      ('w1', 'CAH Base Set'), ('w2', 'CAH Base Set'), ('w3', 'Only Cards'),
      ('w4', NULL), ('w5', 'Clash Raw');
    INSERT INTO black_cards (text, pack) VALUES ('b1', 'CAH Base Set'), ('b2', 'Renamed Raw');
    INSERT INTO card_packs (pack, display_name, series, nsfw) VALUES
      ('Renamed Raw', 'Pretty Name', 'Series X', true),
      ('Clash Pretty', 'Clash Raw', NULL, false),
      ('Blank Display', '   ', NULL, false);
    INSERT INTO default_card_packs (pack) VALUES ('CAH Base Set'), ('Default No Cards');
  `);
  const statements = readFileSync(sqlPath, "utf8").split("--> statement-breakpoint");
  for (const statement of statements) {
    if (statement.trim()) await client.query(statement);
  }
});

afterAll(async () => {
  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await client.end();
});

describe("migration 0012_pack_ids", () => {
  it("creates one registry row per pack referenced anywhere", async () => {
    const names = (await rows("SELECT name FROM card_packs ORDER BY name")).map((r) => r.name);
    expect(names).toEqual([
      "Blank Display",
      "CAH Base Set",
      "Clash Pretty",
      "Clash Raw",
      "Default No Cards",
      "Only Cards",
      "Pretty Name",
    ]);
  });

  it("promotes a display name to the name and keeps the other metadata", async () => {
    const [row] = await rows("SELECT name, series, nsfw FROM card_packs WHERE pack = 'Renamed Raw'");
    expect(row).toEqual({ name: "Pretty Name", series: "Series X", nsfw: true });
  });

  it("lets the pack whose raw key is the contested name keep it", async () => {
    const [raw] = await rows("SELECT name FROM card_packs WHERE pack = 'Clash Raw'");
    const [pretty] = await rows("SELECT name FROM card_packs WHERE pack = 'Clash Pretty'");
    expect(raw.name).toBe("Clash Raw");
    expect(pretty.name).toBe("Clash Pretty");
  });

  it("ignores a blank display name", async () => {
    const [row] = await rows("SELECT name FROM card_packs WHERE pack = 'Blank Display'");
    expect(row.name).toBe("Blank Display");
  });

  it("carries default status onto is_default", async () => {
    const names = (await rows("SELECT name FROM card_packs WHERE is_default ORDER BY name")).map((r) => r.name);
    expect(names).toEqual(["CAH Base Set", "Default No Cards"]);
  });

  it("points every card with a pack at its registry row", async () => {
    const [{ count }] = await rows(
      "SELECT count(*)::int AS count FROM white_cards w JOIN card_packs c ON c.id = w.pack_id",
    );
    expect(count).toBe(4);
    const [orphan] = await rows("SELECT pack_id FROM white_cards WHERE text = 'w4'");
    expect(orphan.pack_id).toBeNull();
    const [black] = await rows(
      "SELECT c.name FROM black_cards b JOIN card_packs c ON c.id = b.pack_id WHERE b.text = 'b2'",
    );
    expect(black.name).toBe("Pretty Name");
  });

  it("enforces unique names and a real pack id on cards", async () => {
    await expect(client.query("INSERT INTO card_packs (name) VALUES ('CAH Base Set')")).rejects.toThrow();
    await expect(
      client.query("INSERT INTO white_cards (text, pack_id) VALUES ('x', gen_random_uuid())"),
    ).rejects.toThrow();
  });
});
