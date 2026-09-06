import { getRandomInt } from "~/composables/useCrypto";

/**
 * Shuffles an array in-place using a cryptographically secure random number generator.
 * @param array The array to shuffle
 * @returns A new shuffled array
 */
export const shuffle = <T>(array: T[]): T[] => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
};
