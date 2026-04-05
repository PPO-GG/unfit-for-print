/**
 * Converts a hex-encoded string to Uint8Array.
 */
export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verifies a Discord interaction request signature using Ed25519.
 * Uses the Web Crypto API (compatible with Cloudflare Workers and Node 20+).
 *
 * @param rawBody - The raw request body as a string
 * @param signature - The X-Signature-Ed25519 header value
 * @param timestamp - The X-Signature-Timestamp header value
 * @param publicKey - Your Discord application's public key (hex)
 * @returns true if the signature is valid
 */
export async function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      hexToUint8Array(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      hexToUint8Array(signature),
      encoder.encode(timestamp + rawBody),
    );
  } catch {
    return false;
  }
}
