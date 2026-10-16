import crypto from "crypto";
import bcrypt from "bcryptjs";
export const POINT_CARD_PREFIX = "points-v1:";
export function pointCardKey() {
  const raw = process.env.POINT_CARD_KEY?.trim();
  if (!raw || raw.length < 32) throw new Error("POINT_CARD_KEY must contain at least 32 characters");
  return crypto.createHash("sha256").update(raw).digest();
}
export function encryptPointCardSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", pointCardKey(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return POINT_CARD_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function decryptPointCardSecret(payload: string) {
  const buf = Buffer.from(payload.slice(POINT_CARD_PREFIX.length), "base64");
  if (!payload.startsWith(POINT_CARD_PREFIX) || buf.length < 28) throw new Error("Invalid point card payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", pointCardKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
export async function hashPointCardSecret(secret: string) { return POINT_CARD_PREFIX + await bcrypt.hash(secret + pointCardKey().toString("hex"), 12); }
export async function verifyPointCardSecret(secret: string, hash: string) { return bcrypt.compare(secret + pointCardKey().toString("hex"), hash.slice(POINT_CARD_PREFIX.length)); }
