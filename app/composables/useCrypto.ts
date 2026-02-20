/**
 * Composable for cryptographically secure random number generation
 * This provides utility functions for generating unbiased random values
 * using the Web Crypto API.
 */

/**
 * Generates an unbiased random integer between 0 and max-1
 * Uses rejection sampling to avoid modulo bias
 *
 * @param max The upper bound (exclusive) for the random integer
 * @returns A random integer between 0 and max-1
 */
export const getRandomInt = (max: number): number => {
  const maxUint32 = 4294967296; // 2^32

  // Calculate the largest multiple of max that is less than maxUint32
  const maxValidValue = Math.floor(maxUint32 / max) * max;

  // Generate random values until we get one that's less than maxValidValue
  let randomValue: number;
  do {
    randomValue = crypto.getRandomValues(new Uint32Array(1))[0]!;
  } while (randomValue >= maxValidValue);

  // Now we can safely use modulo without bias
  return randomValue % max;
};

/**
 * Generates an unbiased random float between min and max
 *
 * @param min The lower bound (inclusive) for the random float
 * @param max The upper bound (exclusive) for the random float
 * @returns A random float between min and max
 */
export const getRandomFloat = (min: number, max: number): number => {
  // Generate a random 32-bit value and convert to a float between 0 and 1
  const randomFloat = getRandomInt(4294967296) / 4294967296;

  // Scale to the desired range
  return min + randomFloat * (max - min);
};

/**
 * Generates a random value within a range
 * If a single number is provided, returns that number
 * If an array with two numbers is provided, returns a random number in that range
 *
 * @param val Either a single number or an array of two numbers representing a range
 * @returns Either the input number or a random number within the specified range
 */
export const getRandomInRange = (val: number | [number, number]): number => {
  if (typeof val === "number") return val;
  const [min, max] = val;
  return getRandomFloat(min, max);
};

/**
 * Generates random bytes and returns them as a hexadecimal string
 *
 * @param numBytes The number of random bytes to generate
 * @returns A hexadecimal string representation of the random bytes
 */
export const getRandomHexString = (numBytes: number): string => {
  const randomBytes = new Uint8Array(numBytes);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Utility composable for cryptographically secure random number generation
 */
export const useCrypto = () => {
  return {
    getRandomInt,
    getRandomFloat,
    getRandomInRange,
    getRandomHexString,
  };
};
