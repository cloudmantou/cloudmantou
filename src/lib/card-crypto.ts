import crypto from "crypto";
import bcrypt from "bcryptjs";

const CARD_SECRET_SALT = process.env.CARD_SECRET_SALT;
if (!CARD_SECRET_SALT) {
  throw new Error("CARD_SECRET_SALT is required — set it in .env (generate with: openssl rand -hex 32)");
}

// bcrypt rounds — 与密码哈希保持一致的性能标准
const BCRYPT_ROUNDS = 12;

/**
 * 卡密哈希（bcrypt）：数据库只存哈希值，明文只在生成时返回一次
 *
 * 使用 bcrypt 慢哈希替代原 SHA-256，防止暴力破解和彩虹表攻击
 */
export async function hashCardSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret + CARD_SECRET_SALT, BCRYPT_ROUNDS);
}

/**
 * 验证卡密：兼容 bcrypt 新哈希和 SHA-256 旧哈希
 *
 * - 优先尝试 bcrypt 比对（新卡密）
 * - 若失败，回退到 SHA-256 比对（存量旧卡密）
 * - 旧哈希格式为 64 位 hex 字符串，新哈希以 $2 开头
 *
 * @returns 验证是否通过
 */
export async function verifyCardSecret(secret: string, hash: string): Promise<boolean> {
  // bcrypt 哈希以 $2 开头
  if (hash.startsWith("$2")) {
    return bcrypt.compare(secret + CARD_SECRET_SALT, hash);
  }

  // 回退到旧 SHA-256 比对（存量数据兼容）
  const legacyHash = crypto
    .createHash("sha256")
    .update(secret + CARD_SECRET_SALT)
    .digest("hex");
  return legacyHash === hash;
}

/**
 * 判断哈希是否为旧版 SHA-256 格式（用于调用方决定是否需要升级）
 */
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith("$2");
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
