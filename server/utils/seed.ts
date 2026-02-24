// server/utils/seed.ts
import fs from "fs";
import path from "path";
import { compareTwoStrings } from "string-similarity";
import { Query } from "appwrite";

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
  resumeFrom = null, // For resuming from a specific point after failure
}: {
  databases: any;
  databaseId: string;
  whiteCollection?: string;
  blackCollection?: string;
  jsonContent?: string | null;
  onProgress?: ((progress: number, stats?: any) => void) | null;
  similarityThreshold?: number;
  resumeFrom?: {
    packIndex: number;
    cardIndex: number;
    cardType: "white" | "black";
  } | null;
}) => {
  let data;
  const tables = getAdminTables();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (jsonContent) {
      // Use provided JSON content
      data = JSON.parse(jsonContent);
    } else {
      // Fallback to default file
      const filePath = path.resolve("assets/data/cah-cards-full.json");
      const raw = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(raw);
    }
  } catch (err: any) {
    const errorMsg = `Failed to parse JSON: ${err.message}`;
    console.error(errorMsg);
    return { success: false, message: errorMsg };
  }

  // Validate basic structure
  if (!Array.isArray(data)) {
    const errorMsg = "Invalid JSON format: Expected an array of card packs";
    console.error(errorMsg);
    return { success: false, message: errorMsg };
  }

  // Count total cards
  let totalCards = 0;
  let totalPacks = data.length;
  let whiteCardCount = 0;
  let blackCardCount = 0;

  for (const pack of data) {
    const whiteCards = pack.white?.length || 0;
    const blackCards = pack.black?.length || 0;
    whiteCardCount += whiteCards;
    blackCardCount += blackCards;
    totalCards += whiteCards + blackCards;
  }

  console.log(
    `Processing ${totalCards} cards (${whiteCardCount} white, ${blackCardCount} black) from ${totalPacks} packs`,
  );

  // Initialize counters
  let insertedCards = 0;
  let skippedDuplicates = 0;
  let skippedSimilar = 0;
  let skippedLongText = 0; // Counter for cards skipped due to text > 255 chars
  let failedCards = 0;

  // Create stats object for progress reporting
  const stats = {
    totalCards,
    totalPacks,
    whiteCardCount,
    blackCardCount,
    insertedCards: 0,
    skippedDuplicates,
    skippedSimilar,
    skippedLongText, // Add counter for cards skipped due to text > 255 chars
    failedCards,
    currentPack: "",
    currentCardType: "",
    errors,
    warnings,
  };

  // Fetch existing cards (we'll need to do this in batches for large collections)
  try {
    console.log("Fetching existing white cards...");
    const existingWhiteCards = await fetchAllCards(
      databases,
      databaseId,
      whiteCollection,
    );
    console.log(`Found ${existingWhiteCards.length} existing white cards`);

    console.log("Fetching existing black cards...");
    const existingBlackCards = await fetchAllCards(
      databases,
      databaseId,
      blackCollection,
    );
    console.log(`Found ${existingBlackCards.length} existing black cards`);

    // Determine starting point (for resume functionality)
    let startPackIndex = 0;
    let startCardIndex = 0;
    let startCardType = "white";

    if (resumeFrom) {
      startPackIndex = resumeFrom.packIndex;
      startCardIndex = resumeFrom.cardIndex;
      startCardType = resumeFrom.cardType;
      console.log(
        `Resuming from pack ${startPackIndex}, ${startCardType} card ${startCardIndex}`,
      );
      warnings.push(
        `Resumed from previous failure at pack ${startPackIndex}, ${startCardType} card ${startCardIndex}`,
      );
    }

    // Process each pack
    for (let packIndex = 0; packIndex < data.length; packIndex++) {
      const pack = data[packIndex];
      const packName = pack.name || `Pack ${pack.pack || "unknown"}`;
      stats.currentPack = packName;

      // Skip packs if resuming
      if (packIndex < startPackIndex) {
        // Calculate cards to skip for progress reporting
        const skippedWhite = pack.white?.length || 0;
        const skippedBlack = pack.black?.length || 0;
        insertedCards += skippedWhite + skippedBlack;
        continue;
      }

      // Process white cards
      if (pack.white && Array.isArray(pack.white)) {
        stats.currentCardType = "white";

        for (let cardIndex = 0; cardIndex < pack.white.length; cardIndex++) {
          // Skip cards if resuming and in the first pack
          if (
            packIndex === startPackIndex &&
            startCardType === "white" &&
            cardIndex < startCardIndex
          ) {
            insertedCards++;
            continue;
          }

          const card = pack.white[cardIndex];
          if (!card.text) {
            warnings.push(
              `Skipped white card with no text in pack "${packName}"`,
            );
            insertedCards++;
            continue;
          }

          // Save current position for potential resume
          const currentPosition = {
            packIndex,
            cardIndex,
            cardType: "white" as const,
          };

          // Skip cards with text longer than 255 characters
          if (card.text.length > 255) {
            skippedLongText++;
            stats.skippedLongText = skippedLongText;
            const warningMsg = `Skipped white card with text > 255 characters in pack "${packName}": "${card.text.substring(0, 50)}..."`;
            console.log(warningMsg);
            warnings.push(warningMsg);
            insertedCards++;
            renderProgressBar(insertedCards, totalCards);
            if (onProgress) {
              onProgress(insertedCards / totalCards, {
                ...stats,
                position: currentPosition,
              });
            }
            continue;
          }

          // Check for exact duplicates first (faster than similarity check)
          const exactDuplicate = existingWhiteCards.some(
            (existingCard) =>
              existingCard.text.toLowerCase() === card.text.toLowerCase(),
          );

          if (exactDuplicate) {
            skippedDuplicates++;
            stats.skippedDuplicates = skippedDuplicates;
            insertedCards++;
            renderProgressBar(insertedCards, totalCards);
            if (onProgress) {
              onProgress(insertedCards / totalCards, {
                ...stats,
                position: currentPosition,
              });
            }
            continue;
          }

          // Check for similar cards
          const similarCard = findSimilarCard(
            card.text,
            existingWhiteCards,
            similarityThreshold,
          );
          if (similarCard) {
            skippedSimilar++;
            stats.skippedSimilar = skippedSimilar;
            const warningMsg = `Skipped similar white card: "${card.text}" (similar to "${similarCard.text}")`;
            console.log(warningMsg);
            warnings.push(warningMsg);
            insertedCards++;
            renderProgressBar(insertedCards, totalCards);
            if (onProgress) {
              onProgress(insertedCards / totalCards, {
                ...stats,
                position: currentPosition,
              });
            }
            continue;
          }

          try {
            const newCard = await tables.createRow({ databaseId: databaseId, tableId: whiteCollection, rowId: "unique()", data: {
                text: card.text,
                pack: packName,
                active: true,
              } });

            // Add to our local cache of existing cards
            existingWhiteCards.push(newCard);
            stats.insertedCards++;
          } catch (err: any) {
            if (err.code === 409) {
              skippedDuplicates++;
              stats.skippedDuplicates = skippedDuplicates;
              warnings.push(
                `Duplicate white card detected: "${card.text}" in pack "${packName}"`,
              );
            } else {
              failedCards++;
              stats.failedCards = failedCards;
              const errorMsg = `White card insert error: ${err.message} for card "${card.text}" in pack "${packName}"`;
              console.error(errorMsg);
              errors.push(errorMsg);

              // Return current position for potential resume
              return {
                success: false,
                message: `Failed at white card "${card.text}" in pack "${packName}"`,
                resumePosition: currentPosition,
                stats: { ...stats },
              };
            }
          }

          insertedCards++;
          renderProgressBar(insertedCards, totalCards);
          if (onProgress) {
            onProgress(insertedCards / totalCards, {
              ...stats,
              position: currentPosition,
            });
          }
        }
      }

      // Process black cards
      if (pack.black && Array.isArray(pack.black)) {
        stats.currentCardType = "black";

        for (let cardIndex = 0; cardIndex < pack.black.length; cardIndex++) {
          // Skip cards if resuming and in the first pack
          if (
            packIndex === startPackIndex &&
            startCardType === "black" &&
            cardIndex < startCardIndex
          ) {
            insertedCards++;
            continue;
          }

          const card = pack.black[cardIndex];
          if (!card.text) {
            warnings.push(
              `Skipped black card with no text in pack "${packName}"`,
            );
            insertedCards++;
            continue;
          }

          // Save current position for potential resume
          const currentPosition = {
            packIndex,
            cardIndex,
            cardType: "black" as const,
          };

          // Skip cards with text longer than 255 characters
          if (card.text.length > 255) {
            skippedLongText++;
            stats.skippedLongText = skippedLongText;
            const warningMsg = `Skipped black card with text > 255 characters in pack "${packName}": "${card.text.substring(0, 50)}..."`;
            console.log(warningMsg);
            warnings.push(warningMsg);
            insertedCards++;
            renderProgressBar(insertedCards, totalCards);
            if (onProgress) {
              onProgress(insertedCards / totalCards, {
                ...stats,
                position: currentPosition,
              });
            }
            continue;
          }

          // Check for exact duplicates first
          const exactDuplicate = existingBlackCards.some(
            (existingCard) =>
              existingCard.text.toLowerCase() === card.text.toLowerCase(),
          );

          if (exactDuplicate) {
            skippedDuplicates++;
            stats.skippedDuplicates = skippedDuplicates;
            insertedCards++;
            renderProgressBar(insertedCards, totalCards);
            if (onProgress) {
              onProgress(insertedCards / totalCards, {
                ...stats,
                position: currentPosition,
              });
            }
            continue;
          }

          // Check for similar cards
          const similarCard = findSimilarCard(
            card.text,
            existingBlackCards,
            similarityThreshold,
          );
          if (similarCard) {
            skippedSimilar++;
            stats.skippedSimilar = skippedSimilar;
            const warningMsg = `Skipped similar black card: "${card.text}" (similar to "${similarCard.text}")`;
            console.log(warningMsg);
            warnings.push(warningMsg);
            insertedCards++;
            renderProgressBar(insertedCards, totalCards);
            if (onProgress) {
              onProgress(insertedCards / totalCards, {
                ...stats,
                position: currentPosition,
              });
            }
            continue;
          }

          try {
            const newCard = await tables.createRow({ databaseId: databaseId, tableId: blackCollection, rowId: "unique()", data: {
                text: card.text,
                pick: card.pick || 1,
                pack: packName,
                active: true,
              } });

            // Add to our local cache of existing cards
            existingBlackCards.push(newCard);
            stats.insertedCards++;
          } catch (err: any) {
            if (err.code === 409) {
              skippedDuplicates++;
              stats.skippedDuplicates = skippedDuplicates;
              warnings.push(
                `Duplicate black card detected: "${card.text}" in pack "${packName}"`,
              );
            } else {
              failedCards++;
              stats.failedCards = failedCards;
              const errorMsg = `Black card insert error: ${err.message} for card "${card.text}" in pack "${packName}"`;
              console.error(errorMsg);
              errors.push(errorMsg);

              // Return current position for potential resume
              return {
                success: false,
                message: `Failed at black card "${card.text}" in pack "${packName}"`,
                resumePosition: currentPosition,
                stats: { ...stats },
              };
            }
          }

          insertedCards++;
          renderProgressBar(insertedCards, totalCards);
          if (onProgress) {
            onProgress(insertedCards / totalCards, {
              ...stats,
              position: currentPosition,
            });
          }
        }
      }
    }
  } catch (err: any) {
    const errorMsg = `Unexpected error during card processing: ${err.message}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    return {
      success: false,
      message: errorMsg,
      stats: { ...stats },
    };
  }

  // Update final stats
  stats.insertedCards =
    insertedCards - skippedDuplicates - skippedSimilar - skippedLongText;
  stats.skippedDuplicates = skippedDuplicates;
  stats.skippedSimilar = skippedSimilar;
  stats.skippedLongText = skippedLongText;
  stats.failedCards = failedCards;

  const message = `Seeding complete. Added ${stats.insertedCards} cards. Skipped ${skippedDuplicates} exact duplicates, ${skippedSimilar} similar cards, and ${skippedLongText} cards with text > 255 characters.`;
  console.log(message);

  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}`);
    warnings.slice(0, 5).forEach((warning) => console.log(` - ${warning}`));
    if (warnings.length > 5) {
      console.log(` ... and ${warnings.length - 5} more warnings`);
    }
  }

  return {
    success: true,
    message,
    stats: { ...stats },
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
};

// Helper function to fetch all cards from a collection (with pagination)
async function fetchAllCards(
  databases: any,
  databaseId: string,
  collectionId: string,
) {
  const limit = 100;
  let offset = 0;
  const tables = getAdminTables();
  let allCards: any[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await tables.listRows({ databaseId: databaseId, tableId: collectionId, queries: [
      // Appwrite uses Query.limit and Query.offset for pagination
      Query.limit(limit),
      Query.offset(offset),
    ] });

    allCards = [...allCards, ...response.rows];

    if (response.rows.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allCards;
}

// Helper function to find similar cards
function findSimilarCard(
  cardText: string,
  existingCards: any[],
  threshold: number,
) {
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
