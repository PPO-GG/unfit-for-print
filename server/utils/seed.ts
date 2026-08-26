// server/utils/seed.ts
import { compareTwoStrings } from "string-similarity";
import { useDb } from "../db/client";
import { blackCards, whiteCards } from "../db/schema";

const renderProgressBar = (current: number, total: number, barLength = 40) => {
  const percent = current / total;
  const filledLength = Math.round(barLength * percent);
  const bar = "█".repeat(filledLength) + "-".repeat(barLength - filledLength);
  process.stdout.write(`\rProgress: |${bar}| ${Math.round(percent * 100)}%`);
  if (current === total) process.stdout.write("\n");
};

export const seedCardsFromJson = async ({
  jsonContent = null,
  onProgress = null,
  similarityThreshold = 0.85, // Configurable threshold (0.0 to 1.0)
  resumeFrom = null, // For resuming from a specific point after failure
}: {
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
  const db = useDb();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!jsonContent) {
    return { success: false, message: "No JSON content provided" };
  }

  try {
    data = JSON.parse(jsonContent);
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
    const packWhite = pack.white?.length || 0;
    const packBlack = pack.black?.length || 0;
    whiteCardCount += packWhite;
    blackCardCount += packBlack;
    totalCards += packWhite + packBlack;
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
  const logs: string[] = [];
  const logLine = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  const stats = {
    totalCards,
    totalPacks,
    whiteCardCount,
    blackCardCount,
    insertedCards: 0,
    skippedDuplicates,
    skippedSimilar,
    skippedLongText,
    failedCards,
    currentPack: "",
    currentCardType: "",
    errors,
    warnings,
    logs,
  };

  try {
    logLine("Fetching existing white cards...");
    if (onProgress) onProgress(0, { ...stats });
    const existingWhiteCards = await db
      .select({ text: whiteCards.text })
      .from(whiteCards);
    logLine(`Found ${existingWhiteCards.length} existing white cards`);
    if (onProgress) onProgress(0, { ...stats });

    logLine("Fetching existing black cards...");
    if (onProgress) onProgress(0, { ...stats });
    const existingBlackCards = await db
      .select({ text: blackCards.text })
      .from(blackCards);
    logLine(`Found ${existingBlackCards.length} existing black cards`);
    if (onProgress) onProgress(0, { ...stats });

    // Determine starting point (for resume functionality)
    let startPackIndex = 0;
    let startCardIndex = 0;
    let startCardType = "white";

    if (resumeFrom) {
      startPackIndex = resumeFrom.packIndex;
      startCardIndex = resumeFrom.cardIndex;
      startCardType = resumeFrom.cardType;
      logLine(
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
        const skippedWhite = pack.white?.length || 0;
        const skippedBlack = pack.black?.length || 0;
        insertedCards += skippedWhite + skippedBlack;
        continue;
      }

      // Process white cards
      if (pack.white && Array.isArray(pack.white)) {
        stats.currentCardType = "white";

        for (let cardIndex = 0; cardIndex < pack.white.length; cardIndex++) {
          if (
            packIndex === startPackIndex &&
            startCardType === "white" &&
            cardIndex < startCardIndex
          ) {
            insertedCards++;
            continue;
          }

          const rawCard = pack.white[cardIndex];
          // Normalize: CAH JSON stores white cards as plain strings OR { text } objects
          const card =
            typeof rawCard === "string" ? { text: rawCard } : rawCard;
          if (!card.text) {
            warnings.push(
              `Skipped white card with no text in pack "${packName}"`,
            );
            insertedCards++;
            continue;
          }

          const currentPosition = {
            packIndex,
            cardIndex,
            cardType: "white" as const,
          };

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
            await db.insert(whiteCards).values({
              text: card.text,
              pack: packName,
              active: true,
            });

            existingWhiteCards.push({ text: card.text });
            stats.insertedCards++;
          } catch (err: any) {
            failedCards++;
            stats.failedCards = failedCards;
            const errorMsg = `White card insert error: ${err.message} for card "${card.text}" in pack "${packName}"`;
            console.error(errorMsg);
            errors.push(errorMsg);

            return {
              success: false,
              message: `Failed at white card "${card.text}" in pack "${packName}"`,
              resumePosition: currentPosition,
              stats: { ...stats },
            };
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

          const currentPosition = {
            packIndex,
            cardIndex,
            cardType: "black" as const,
          };

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
            await db.insert(blackCards).values({
              text: card.text,
              pick: card.pick || 1,
              pack: packName,
              active: true,
            });

            existingBlackCards.push({ text: card.text });
            stats.insertedCards++;
          } catch (err: any) {
            failedCards++;
            stats.failedCards = failedCards;
            const errorMsg = `Black card insert error: ${err.message} for card "${card.text}" in pack "${packName}"`;
            console.error(errorMsg);
            errors.push(errorMsg);

            return {
              success: false,
              message: `Failed at black card "${card.text}" in pack "${packName}"`,
              resumePosition: currentPosition,
              stats: { ...stats },
            };
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
  logLine(message);

  if (warnings.length > 0) {
    logLine(`Warnings: ${warnings.length}`);
    warnings.slice(0, 5).forEach((warning) => logLine(` - ${warning}`));
    if (warnings.length > 5) {
      logLine(` ... and ${warnings.length - 5} more warnings`);
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

// Helper function to find similar cards
function findSimilarCard(
  cardText: string,
  existingCards: { text: string }[],
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
