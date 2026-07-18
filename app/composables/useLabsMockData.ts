/**
 * Mock data for the /labs page.
 *
 * The real /labs page hits Appwrite for submissions (real) but the new
 * design also renders packs, contributors, and head-to-head voting
 * mechanics that don't have backing systems yet. This module is the
 * single source of truth for those stubs — wrapper composables
 * (useLabsStats, useLabsPacks, useLabsContributors) re-export slices.
 *
 * See docs/ui-overhaul-future-features.md → Labs section for the wiring
 * plan to replace each of these with real APIs.
 */

import type {
  LabsContributor,
  LabsPack,
  LabsPackCard,
  LabsStats,
} from "~/types/labs";

export const LABS_STATS_MOCK: LabsStats = {
  totalSubmissions: 2847,
  votesCast: 184320,
  inPlaytest: 142,
  graduated: 89,
  contributors: 412,
  thisWeek: 38,
};

export const LABS_PACKS_MOCK: LabsPack[] = [
  { id: "main", name: "Main Deck", cards: 1450, white: 920, black: 530, plays: 142000, rating: 4.8, vibe: "core", color: "oklch(78% 0.20 195)", desc: "The default. Everything you need to ruin a friendship.", official: true, new: false },
  { id: "lab-graduates", name: "Lab Graduates v3", cards: 87, white: 62, black: 25, plays: 8200, rating: 4.6, vibe: "fresh", color: "oklch(82% 0.18 95)", desc: "Cards graduated from the Labs in the last quarter. Battle-tested.", official: true, new: true, source: "labs" },
  { id: "absurd-box", name: "Absurd Box Expansion", cards: 297, white: 198, black: 99, plays: 41200, rating: 4.4, vibe: "weird", color: "oklch(70% 0.20 295)", desc: "Surrealist nonsense. Banana phones, sentient mayonnaise, etc.", official: true, new: false },
  { id: "holiday-2017", name: "2017 Holiday Pack", cards: 30, white: 23, black: 7, plays: 18900, rating: 4.5, vibe: "seasonal", color: "oklch(72% 0.22 355)", desc: "Christmas-themed dread. Dust off once a year.", official: true, new: false },
  { id: "90s-nostalgia", name: "90s Nostalgia Pack", cards: 32, white: 24, black: 8, plays: 24500, rating: 4.7, vibe: "nostalgic", color: "oklch(76% 0.18 320)", desc: "Tamagotchis, dial-up, Crystal Pepsi. You'll feel old.", official: true, new: false },
  { id: "college", name: "College Pack", cards: 30, white: 22, black: 8, plays: 31000, rating: 4.3, vibe: "spicy", color: "oklch(74% 0.20 175)", desc: "Beer pong, RA drama, ramen-fueled regret.", official: true, new: false },
  { id: "office-life", name: "Office Life Pack", cards: 28, white: 22, black: 6, plays: 16800, rating: 4.2, vibe: "corporate", color: "oklch(78% 0.18 50)", desc: "Slack reactions, performance reviews, the printer.", official: true, new: false },
  { id: "chaos-mode", name: "Chaos Mode", cards: 64, white: 40, black: 24, plays: 12400, rating: 4.6, vibe: "chaos", color: "oklch(72% 0.22 25)", desc: "Multi-pick prompts. Bring a friend. And a lawyer.", official: true, new: true },
  { id: "dad-jokes", name: "Dad Joke Bundle", cards: 22, white: 22, black: 0, plays: 9100, rating: 3.9, vibe: "wholesome", color: "oklch(80% 0.20 140)", desc: "Wholesome enough to play with your dad. Almost.", official: true, new: false },
  { id: "internet-rotten", name: "Internet Rotten", cards: 78, white: 52, black: 26, plays: 22000, rating: 4.5, vibe: "online", color: "oklch(70% 0.22 260)", desc: "Doomscrolling, parasocial, lore. The good stuff.", official: true, new: true },
];

export const LABS_PACK_CARDS_MOCK: Record<string, LabsPackCard[]> = {
  main: [
    { kind: "answer", text: "Unwarranted optimism." },
    { kind: "prompt", text: "What's a girl's best friend? ___." },
    { kind: "answer", text: "A really, really sad clown." },
    { kind: "prompt", text: "Why am I sticky? ___." },
    { kind: "answer", text: "Slowly losing the will to use punctuation." },
    { kind: "prompt", text: "I drink to forget ___." },
    { kind: "answer", text: "Whatever Karen ordered." },
  ],
  "lab-graduates": [
    { kind: "answer", text: "A sentient Roomba with a grudge." },
    { kind: "answer", text: "Crying in the produce aisle. Again." },
    { kind: "prompt", text: "What's making my mom cry this Thanksgiving? ___." },
    { kind: "answer", text: "Telling a child their goldfish 'went on vacation.'" },
    { kind: "answer", text: "Aggressively making eye contact during a sneeze." },
    { kind: "prompt", text: "The real reason I got fired from my last job: ___." },
  ],
  "absurd-box": [
    { kind: "answer", text: "A horse made entirely of small horses." },
    { kind: "answer", text: "Sentient mayonnaise demanding rights." },
    { kind: "prompt", text: "I'd like to thank ___ for inventing ___." },
    { kind: "answer", text: "Three raccoons in a trench coat." },
    { kind: "answer", text: "The concept of Tuesday." },
  ],
  "holiday-2017": [
    { kind: "answer", text: "Three french hens, two turtle doves, and ___." },
    { kind: "prompt", text: "On the third day of Christmas, my true love gave to me: ___." },
    { kind: "answer", text: "Jesus is ___." },
  ],
  "90s-nostalgia": [
    { kind: "answer", text: "A Tamagotchi I let die." },
    { kind: "answer", text: "Dial-up internet sounds." },
    { kind: "answer", text: "Crystal Pepsi." },
    { kind: "answer", text: "Trapper Keeper trauma." },
  ],
  college: [
    { kind: "answer", text: "An RA who took it WAY too seriously." },
    { kind: "answer", text: "$8 ramen and a moral crisis." },
    { kind: "prompt", text: "Why did my roommate get evicted? ___." },
  ],
  "office-life": [
    { kind: "answer", text: "Slack reactions as a love language." },
    { kind: "answer", text: "Karen from accounting." },
    { kind: "prompt", text: "Why does the printer hate me? ___." },
  ],
  "chaos-mode": [
    { kind: "prompt", text: "I'm sorry, professor. I couldn't finish the homework because ___, ___, and ___." },
    { kind: "answer", text: "An emotional support gecko." },
  ],
  "dad-jokes": [
    { kind: "answer", text: "I'm not a regular dad, I'm a cool dad." },
    { kind: "answer", text: "Going to the store. Want anything?" },
  ],
  "internet-rotten": [
    { kind: "answer", text: "Doomscrolling at 3am, but spiritually." },
    { kind: "answer", text: "A parasocial relationship with a podcast host." },
    { kind: "answer", text: "Lore." },
  ],
};

export const LABS_CONTRIBUTORS_MOCK: LabsContributor[] = [
  { rank: 1, name: "MYND", initials: "MY", bg: "oklch(78% 0.20 195)", submissions: 47, graduated: 12, totalUp: 8420, badge: "MAD SCIENTIST", self: true },
  { rank: 2, name: "GROVER", initials: "GR", bg: "oklch(72% 0.22 355)", submissions: 38, graduated: 9, totalUp: 6210, badge: "TENURED" },
  { rank: 3, name: "PEPPER", initials: "PP", bg: "oklch(72% 0.18 20)", submissions: 31, graduated: 7, totalUp: 5840, badge: "TENURED" },
  { rank: 4, name: "JFROG", initials: "JF", bg: "oklch(82% 0.18 95)", submissions: 29, graduated: 5, totalUp: 4620, badge: "RESEARCHER" },
  { rank: 5, name: "LEELA", initials: "LE", bg: "oklch(80% 0.20 140)", submissions: 22, graduated: 4, totalUp: 3890, badge: "RESEARCHER" },
  { rank: 6, name: "MAXWELL", initials: "MX", bg: "oklch(70% 0.22 260)", submissions: 18, graduated: 3, totalUp: 2940, badge: "INTERN" },
  { rank: 7, name: "QUINN", initials: "QU", bg: "oklch(74% 0.20 175)", submissions: 15, graduated: 2, totalUp: 2100, badge: "INTERN" },
  { rank: 8, name: "BIRDIE", initials: "BD", bg: "oklch(76% 0.18 320)", submissions: 11, graduated: 1, totalUp: 1620, badge: "INTERN" },
];
