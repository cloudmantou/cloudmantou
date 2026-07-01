import crypto from "crypto";

const CARD_SECRET_SALT = process.env.CARD_SECRET_SALT || "cloudmantou-card-salt-2026";

/**
 * 卡密哈希：数据库只存哈希值，明文只在生成时返回一次
 */
export function hashCardSecret(secret: string): string {
  return crypto
    .createHash("sha256")
    .update(secret + CARD_SECRET_SALT)
    .digest("hex");
}

export function verifyCardSecret(secret: string, hash: string): boolean {
  return hashCardSecret(secret) === hash;
}

export function generateCardNo(): string {
  const prefix = "CM";
  const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function generateCardSecret(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}
