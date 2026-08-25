import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.NUXT_ACTIVITY_TOKEN_SECRET;
  if (!secret) {
    throw new Error("[activityToken] NUXT_ACTIVITY_TOKEN_SECRET is not set");
  }
  return secret;
}

export function signActivityToken(userId: string): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + TOKEN_TTL_MS });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyActivityToken(token: string): { userId: string } | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expectedSig = createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
