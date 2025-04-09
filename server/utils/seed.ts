// server/utils/seed.ts
import fs from "fs";
import path from "path";

const config = useRuntimeConfig();

const renderProgressBar = (current: number, total: number, barLength = 40) => {
  const percent = current / total;
  const filledLength = Math.round(barLength * percent);
  const bar = "█".repeat(filledLength) + "-".repeat(barLength - filledLength);
  process.stdout.write(`\rProgress: |${bar}| ${Math.round(percent * 100)}%`);
  if (current === total) process.stdout.write("\n");
};

export const seedCardsFromJson = async ({
  databases,
  databaseId,
  whiteCollection = config.public.appwriteWhiteCardCollectionId,
  blackCollection = config.public.appwriteBlackCardCollectionId,
}: {
  databases: any;
  databaseId: string;
  whiteCollection?: string;
  blackCollection?: string;
}) => {
  const filePath = path.resolve("assets/data/cah-cards-full.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  const existing = await databases.listDocuments(
    databaseId,
    whiteCollection,
    [],
    { limit: 1 }
  );
  if (existing.total > 0) {
    return { success: true, message: "Cards already seeded. Skipping." };
  }

  // Count total cards
  let totalCards = 0;
  for (const pack of data) {
    totalCards += (pack.white?.length || 0) + (pack.black?.length || 0);
  }

  let insertedCards = 0;

  for (const pack of data) {
    const packName = pack.name || `Pack ${pack.pack || "unknown"}`;

    for (const card of pack.white || []) {
      if (!card.text) continue;
      try {
        await databases.createDocument(
          databaseId,
          whiteCollection,
          "unique()",
          {
            text: card.text,
            pack: packName,
            active: true,
          }
        );
      } catch (err: any) {
        if (err.code !== 409)
          console.error("\nWhite card insert error:", err.message);
      }
      insertedCards++;
      renderProgressBar(insertedCards, totalCards);
    }

    for (const card of pack.black || []) {
      if (!card.text) continue;
      try {
        await databases.createDocument(
          databaseId,
          blackCollection,
          "unique()",
          {
            text: card.text,
            pick: card.pick || 1,
            pack: packName,
            active: true,
          }
        );
      } catch (err: any) {
        if (err.code !== 409)
          console.error("\nBlack card insert error:", err.message);
      }
      insertedCards++;
      renderProgressBar(insertedCards, totalCards);
    }
  }

  return { success: true, message: "Seeding complete" };
};
