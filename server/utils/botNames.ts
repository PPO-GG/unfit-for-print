// server/utils/botNames.ts
// Generates fun, human-ish bot names from adjective + noun combos.
// Deterministic avatar URLs via DiceBear's bottts-neutral style.

const ADJECTIVES = [
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
];

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

/**
 * Pick a random bot name that doesn't collide with existing names in the lobby.
 * Falls back to appending a short numeric suffix if all combos are exhausted
 * (2,500 combos vs max 5 bots — practically impossible).
 */
export function generateBotName(existingNames: string[]): string {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));

  // Try up to 20 random draws before falling back
  for (let i = 0; i < 20; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
    const name = `${adj}${noun}`;
    if (!taken.has(name.toLowerCase())) return name;
  }

  // Fallback — extremely unlikely with 2,500 combos and max 5 bots
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
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
