// server/utils/lobbyPassword.ts
//
// Hashing for lobby join passwords.
//
// Wraps @adonisjs/hash's scrypt driver — the same implementation nuxt-auth-utils
// uses, so behaviour matches the rest of the stack. It is imported directly
// rather than through nuxt-auth-utils' `hashPassword` helper, because that
// helper pulls `useRuntimeConfig` from `#imports`, a Nitro-only alias that
// cannot resolve when a route module is imported straight into a unit test.
// Going one layer down keeps the real algorithm under test instead of a stub.
//
// Output is a PHC string (`$scrypt$n=16384,r=8,p=1$<salt>$<digest>`) carrying
// its own parameters and salt, so verification needs nothing else stored.

import { Hash } from "@adonisjs/hash";
import { Scrypt } from "@adonisjs/hash/drivers/scrypt";

const hasher = new Hash(new Scrypt({}));

export function hashLobbyPassword(password: string): Promise<string> {
  return hasher.make(password);
}

export function verifyLobbyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  // A malformed or truncated hash makes the driver throw rather than return
  // false. Treat anything unreadable as "does not match" — a lobby whose row
  // got corrupted should refuse entry, not 500 at everyone trying to join.
  return hasher.verify(hash, password).catch(() => false);
}
