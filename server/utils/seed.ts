// server/utils/seed.ts
import fs from "fs";
import path from "path";
import { compareTwoStrings } from 'string-similarity';

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
    jsonContent = null,
    onProgress = null,
    similarityThreshold = 0.85, // Configurable threshold (0.0 to 1.0)
  }: {
  databases: any;
  databaseId: string;
  whiteCollection?: string;
  blackCollection?: string;
  jsonContent?: string | null;
  onProgress?: ((progress: number) => void) | null;
  similarityThreshold?: number;
}) => {
  let data;

  if (jsonContent) {
    // Use provided JSON content
    data = JSON.parse(jsonContent);
  } else {
    // Fallback to default file
    const filePath = path.resolve("assets/data/cah-cards-full.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    data = JSON.parse(raw);
  }

  // Count total cards
  let totalCards = 0;
  for (const pack of data) {
    totalCards += (pack.white?.length || 0) + (pack.black?.length || 0);
  }

  let insertedCards = 0;
  let skippedDuplicates = 0;
  let skippedSimilar = 0;

  // Fetch existing cards (we'll need to do this in batches for large collections)
  console.log("Fetching existing white cards...");
  const existingWhiteCards = await fetchAllCards(databases, databaseId, whiteCollection);
  console.log(`Found ${existingWhiteCards.length} existing white cards`);

  console.log("Fetching existing black cards...");
  const existingBlackCards = await fetchAllCards(databases, databaseId, blackCollection);
  console.log(`Found ${existingBlackCards.length} existing black cards`);

  for (const pack of data) {
    const packName = pack.name || `Pack ${pack.pack || "unknown"}`;

    for (const card of pack.white || []) {
      if (!card.text) continue;

      // Check for exact duplicates first (faster than similarity check)
      const exactDuplicate = existingWhiteCards.some(
          existingCard => existingCard.text.toLowerCase() === card.text.toLowerCase()
      );

      if (exactDuplicate) {
        skippedDuplicates++;
        insertedCards++;
        renderProgressBar(insertedCards, totalCards);
        if (onProgress) {
          onProgress(insertedCards / totalCards);
        }
        continue;
      }

      // Check for similar cards
      const similarCard = findSimilarCard(card.text, existingWhiteCards, similarityThreshold);
      if (similarCard) {
        skippedSimilar++;
        console.log(`Skipped similar white card: "${card.text}" (similar to "${similarCard.text}")`);
        insertedCards++;
        renderProgressBar(insertedCards, totalCards);
        if (onProgress) {
          onProgress(insertedCards / totalCards);
        }
        continue;
      }

      try {
        const newCard = await databases.createDocument(
            databaseId,
            whiteCollection,
            "unique()",
            {
              text: card.text,
              pack: packName,
              active: true,
            }
        );

        // Add to our local cache of existing cards
        existingWhiteCards.push(newCard);

      } catch (err: any) {
        if (err.code !== 409)
          console.error("\nWhite card insert error:", err.message);
        else
          skippedDuplicates++;
      }

      insertedCards++;
      renderProgressBar(insertedCards, totalCards);
      if (onProgress) {
        onProgress(insertedCards / totalCards);
      }
    }

    for (const card of pack.black || []) {
      if (!card.text) continue;

      // Check for exact duplicates first
      const exactDuplicate = existingBlackCards.some(
          existingCard => existingCard.text.toLowerCase() === card.text.toLowerCase()
      );

      if (exactDuplicate) {
        skippedDuplicates++;
        insertedCards++;
        renderProgressBar(insertedCards, totalCards);
        if (onProgress) {
          onProgress(insertedCards / totalCards);
        }
        continue;
      }

      // Check for similar cards
      const similarCard = findSimilarCard(card.text, existingBlackCards, similarityThreshold);
      if (similarCard) {
        skippedSimilar++;
        console.log(`Skipped similar black card: "${card.text}" (similar to "${similarCard.text}")`);
        insertedCards++;
        renderProgressBar(insertedCards, totalCards);
        if (onProgress) {
          onProgress(insertedCards / totalCards);
        }
        continue;
      }

      try {
        const newCard = await databases.createDocument(
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

        // Add to our local cache of existing cards
        existingBlackCards.push(newCard);

      } catch (err: any) {
        if (err.code !== 409)
          console.error("\nBlack card insert error:", err.message);
        else
          skippedDuplicates++;
      }

      insertedCards++;
      renderProgressBar(insertedCards, totalCards);
      if (onProgress) {
        onProgress(insertedCards / totalCards);
      }
    }
  }

  const message = `Seeding complete. Added ${insertedCards - skippedDuplicates - skippedSimilar} cards. Skipped ${skippedDuplicates} exact duplicates and ${skippedSimilar} similar cards.`;
  console.log(message);
  return { success: true, message };
};

// Helper function to fetch all cards from a collection (with pagination)
async function fetchAllCards(databases: any, databaseId: string, collectionId: string) {
  const limit = 100;
  let offset = 0;
  let allCards: any[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await databases.listDocuments(
        databaseId,
        collectionId,
        [
          // Add pagination parameters
          // Note: Appwrite uses limit and offset for pagination
          // Adjust based on Appwrite's API
        ],
        { limit, offset }
    );

    allCards = [...allCards, ...response.documents];

    if (response.documents.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allCards;
}

// Helper function to find similar cards
function findSimilarCard(cardText: string, existingCards: any[], threshold: number) {
  const normalizedText = cardText.toLowerCase().trim();

  for (const existingCard of existingCards) {
    const existingText = existingCard.text.toLowerCase().trim();

    // Skip exact matches (these are handled separately)
    if (existingText === normalizedText) continue;

    const similarity = compareTwoStrings(existingText, normalizedText);
    if (similarity >= threshold) {
      return existingCard;
    }
  }

  return null;
}