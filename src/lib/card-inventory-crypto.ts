import { hashCardSecret } from "@/lib/card-crypto";
import { encryptCardSecret } from "@/lib/card-secret-storage";
import { encryptPointCardSecret, hashPointCardSecret } from "@/lib/point-card-crypto";

/** Use the existing versioned key when available. Existing unversioned ciphertext
 * still requires its original delivery key and is never decoded with a new key. */
export async function encodeInventoryCardSecret(secret: string) {
  if (process.env.POINT_CARD_KEY?.trim()) {
    return { hash: await hashPointCardSecret(secret), enc: encryptPointCardSecret(secret) };
  }
  return { hash: await hashCardSecret(secret), enc: encryptCardSecret(secret) };
}
