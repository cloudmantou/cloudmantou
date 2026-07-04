import crypto from "crypto";
import bcrypt from "bcryptjs";

function requireCardSecretSalt(): string {
  const salt = process.env.CARD_SECRET_SALT?.trim();
  if (!salt) {
    throw new Error("CARD_SECRET_SALT is required — set it in .env (generate with: openssl rand -hex 32)");
  }
  return salt;
}

// bcrypt rounds — 与密码哈希保持一致的性能标准
const BCRYPT_ROUNDS = 12;

/**
 * 卡密哈希（bcrypt）：数据库只存哈希值，明文只在生成时返回一次
 *
 * 使用 bcrypt 慢哈希替代原 SHA-256，防止暴力破解和彩虹表攻击
 */
export async function hashCardSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret + requireCardSecretSalt(), BCRYPT_ROUNDS);
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
    return bcrypt.compare(secret + requireCardSecretSalt(), hash);
  }

  // 回退到旧 SHA-256 比对（存量数据兼容）
  const legacyHash = crypto
    .createHash("sha256")
    .update(secret + requireCardSecretSalt())
    .digest("hex");
  return legacyHash === hash;
}

/**
 * 判断哈希是否为旧版 SHA-256 格式（用于调用方决定是否需要升级）
 */
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith("$2");
}

export type CardFormat = "standard" | "uuid" | "numeric" | "custom";

const CARD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSegment(len = 4): string {
  let out = "";
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += CARD_CHARS[bytes[i] % CARD_CHARS.length];
  }
  return out;
}

export function generateCardNo(options?: { prefix?: string; format?: CardFormat }): string {
  const format = options?.format || "standard";
  const prefix = (options?.prefix || "CM").replace(/-+$/, "").toUpperCase();

  if (format === "uuid") {
    return crypto.randomUUID().toUpperCase();
  }

  if (format === "numeric") {
    const bytes = crypto.randomBytes(8);
    let num = "";
    for (let i = 0; i < 16; i++) {
      num += String(bytes[i % 8] % 10);
    }
    return num;
  }

  return `${prefix}-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

export function generateCardSecret(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}
