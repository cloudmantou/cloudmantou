import crypto from "crypto";

function getDeliveryKey(): Buffer {
  const raw = process.env.CARD_DELIVERY_KEY || process.env.CARD_SECRET_SALT;
  if (!raw) {
    throw new Error("CARD_DELIVERY_KEY or CARD_SECRET_SALT is required for card delivery");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptCardSecret(secret: string): string {
  const key = getDeliveryKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptCardSecret(payload: string): string {
  const key = getDeliveryKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}