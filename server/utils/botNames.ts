// server/utils/botNames.ts
// Generates fun, human-ish bot names from adjective + noun combos.
// Deterministic avatar URLs via DiceBear's bottts-neutral style.
//
// The adjective also carries the bot's sense of humor (ADJECTIVE_PERSONA), so a
// player can read a judge's taste from its name — GloomyBadger likes it dark,
// ZanyWaffle likes nonsense — and play to it.

export const ADJECTIVES = [
  "Sneaky",
  "Turbo",
  "Chaos",
  "Cosmic",
  "Spicy",
  "Fuzzy",
  "Cranky",
  "Sleepy",
  "Bouncy",
  "Wobbly",
  "Crispy",
  "Funky",
  "Dizzy",
  "Salty",
  "Chill",
  "Shifty",
  "Rusty",
  "Zippy",
  "Gloomy",
  "Peppy",
  "Fierce",
  "Giddy",
  "Jolly",
  "Nutty",
  "Rowdy",
  "Wacky",
  "Witty",
  "Zany",
  "Dusty",
  "Frosty",
  "Grumpy",
  "Lucky",
  "Sassy",
  "Toasty",
  "Vivid",
  "Breezy",
  "Clumsy",
  "Dopey",
  "Eager",
  "Hasty",
  "Jazzy",
  "Lanky",
  "Mellow",
  "Nerdy",
  "Plucky",
  "Quirky",
  "Snappy",
  "Tricky",
  "Wily",
  "Yappy",
] as const;

const NOUNS = [
  "Panda",
  "Goblin",
  "Pickle",
  "Waffle",
  "Penguin",
  "Cactus",
  "Potato",
  "Noodle",
  "Biscuit",
  "Muffin",
  "Taco",
  "Badger",
  "Donut",
  "Walrus",
  "Pretzel",
  "Llama",
  "Turnip",
  "Moose",
  "Nugget",
  "Otter",
  "Falcon",
  "Wombat",
  "Squid",
  "Raven",
  "Gecko",
  "Tofu",
  "Yeti",
  "Ferret",
  "Pigeon",
  "Cobra",
  "Mango",
  "Quail",
  "Shrimp",
  "Raptor",
  "Puffin",
  "Kitten",
  "Truffle",
  "Sprout",
  "Cracker",
  "Beaver",
  "Hamster",
  "Iguana",
  "Lemur",
  "Pelican",
  "Starfish",
  "Coyote",
  "Heron",
  "Oyster",
  "Vulture",
  "Dingo",
];

export type BotPersona = "dark" | "absurd" | "crowd";

/** Typed by the adjective list: a new adjective without a persona fails typecheck. */
export const ADJECTIVE_PERSONA: Record<(typeof ADJECTIVES)[number], BotPersona> = {
  Sneaky: "dark",
  Spicy: "dark",
  Cranky: "dark",
  Salty: "dark",
  Shifty: "dark",
  Gloomy: "dark",
  Fierce: "dark",
  Grumpy: "dark",
  Sassy: "dark",
  Tricky: "dark",
  Wily: "dark",
  Rowdy: "dark",

  Chaos: "absurd",
  Cosmic: "absurd",
  Fuzzy: "absurd",
  Bouncy: "absurd",
  Wobbly: "absurd",
  Funky: "absurd",
  Dizzy: "absurd",
  Giddy: "absurd",
  Nutty: "absurd",
  Wacky: "absurd",
  Zany: "absurd",
  Clumsy: "absurd",
  Dopey: "absurd",
  Jazzy: "absurd",
  Quirky: "absurd",
  Yappy: "absurd",

  Turbo: "crowd",
  Sleepy: "crowd",
  Crispy: "crowd",
  Chill: "crowd",
  Rusty: "crowd",
  Zippy: "crowd",
  Peppy: "crowd",
  Jolly: "crowd",
  Witty: "crowd",
  Dusty: "crowd",
  Frosty: "crowd",
  Lucky: "crowd",
  Toasty: "crowd",
  Vivid: "crowd",
  Breezy: "crowd",
  Eager: "crowd",
  Hasty: "crowd",
  Lanky: "crowd",
  Mellow: "crowd",
  Nerdy: "crowd",
  Plucky: "crowd",
  Snappy: "crowd",
};

/**
 * The persona of the longest adjective `name` starts with — longest, so no
 * adjective can shadow a longer one it happens to prefix. Names that match no
 * adjective (none are generated, but rows are only data) are crowd-pleasers.
 */
export function personaForBotName(name: string): BotPersona {
  let match: (typeof ADJECTIVES)[number] | undefined;
  for (const adjective of ADJECTIVES) {
    if (name.startsWith(adjective) && (!match || adjective.length > match.length)) {
      match = adjective;
    }
  }
  return match ? ADJECTIVE_PERSONA[match] : "crowd";
}

/**
 * Pick a random bot name that doesn't collide with existing names in the lobby.
 * Prefers an adjective whose persona no bot in the lobby has yet, so a few bots
 * show off different senses of humor. Falls back to appending a short numeric
 * suffix if all combos are exhausted (practically impossible at 5 bots).
 */
export function generateBotName(existingNames: string[]): string {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const held = new Set(existingNames.map((n) => personaForBotName(n)));
  const fresh = ADJECTIVES.filter((a) => !held.has(ADJECTIVE_PERSONA[a]));
  const adjectives = fresh.length > 0 ? fresh : ADJECTIVES;

  // Try up to 20 random draws before falling back
  for (let i = 0; i < 20; i++) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]!;
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
    const name = `${adj}${noun}`;
    if (!taken.has(name.toLowerCase())) return name;
  }

  // Fallback — extremely unlikely with hundreds of combos and max 5 bots
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const suffix = Math.floor(Math.random() * 100);
  return `${adj}${noun}${suffix}`;
}

/**
 * Returns a deterministic DiceBear bottts-neutral avatar URL for the given seed.
 * The seed is typically the bot's name so re-renders are consistent.
 */
export function getBotAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;
}
