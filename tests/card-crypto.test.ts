import { describe, expect, it, beforeAll } from "vitest";
import crypto from "crypto";

/**
 * 安全审计修复验证测试 — 卡密哈希 (card-crypto.ts)
 *
 * 核心验证点：
 * 1. hashCardSecret 返回 bcrypt 哈希（$2 开头），且为 async
 * 2. verifyCardSecret 能正确验证 bcrypt 新哈希（round-trip）
 * 3. verifyCardSecret 能正确识别并验证旧 SHA-256 哈希格式（向后兼容）
 * 4. 错误密钥在两种格式下都返回 false
 * 5. isLegacyHash 正确区分新旧格式
 */

// card-crypto.ts 在模块加载时检查 CARD_SECRET_SALT，缺失则抛错。
// 使用动态导入确保环境变量在模块加载前设置。
let hashCardSecret: (secret: string) => Promise<string>;
let verifyCardSecret: (secret: string, hash: string) => Promise<boolean>;
let isLegacyHash: (hash: string) => boolean;
let CARD_SECRET_SALT: string;

beforeAll(async () => {
  if (!process.env.CARD_SECRET_SALT) {
    process.env.CARD_SECRET_SALT = "test-salt-for-unit-tests-only-not-for-prod";
  }
  const mod = await import("@/lib/card-crypto");
  hashCardSecret = mod.hashCardSecret;
  verifyCardSecret = mod.verifyCardSecret;
  isLegacyHash = mod.isLegacyHash;
  CARD_SECRET_SALT = process.env.CARD_SECRET_SALT!;
});

describe("hashCardSecret — bcrypt 哈希生成", () => {
  it("返回以 $2 开头的 bcrypt 哈希", async () => {
    const hash = await hashCardSecret("SECRET-123");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("同一密钥每次生成不同哈希（bcrypt 内置 salt）", async () => {
    const h1 = await hashCardSecret("SECRET-SAME");
    const h2 = await hashCardSecret("SECRET-SAME");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyCardSecret — bcrypt 新哈希验证", () => {
  it("正确密钥验证通过（round-trip）", async () => {
    const secret = "ROUND-TRIP-SECRET";
    const hash = await hashCardSecret(secret);
    const valid = await verifyCardSecret(secret, hash);
    expect(valid).toBe(true);
  });

  it("错误密钥验证失败", async () => {
    const hash = await hashCardSecret("CORRECT-SECRET");
    const valid = await verifyCardSecret("WRONG-SECRET", hash);
    expect(valid).toBe(false);
  });
});

describe("verifyCardSecret — 旧 SHA-256 哈希兼容", () => {
  it("能正确识别并验证旧 SHA-256 哈希格式", async () => {
    const secret = "LEGACY-SECRET-001";

    // 手动构造旧版 SHA-256 哈希（与 card-crypto.ts 中回退逻辑一致）
    const legacyHash = crypto
      .createHash("sha256")
      .update(secret + CARD_SECRET_SALT)
      .digest("hex");

    // 旧哈希不以 $2 开头
    expect(legacyHash.startsWith("$2")).toBe(false);
    expect(legacyHash.length).toBe(64); // SHA-256 hex = 64 字符

    // verifyCardSecret 应能验证旧哈希
    const valid = await verifyCardSecret(secret, legacyHash);
    expect(valid).toBe(true);
  });

  it("旧 SHA-256 哈希 + 错误密钥验证失败", async () => {
    const secret = "LEGACY-CORRECT";
    const legacyHash = crypto
      .createHash("sha256")
      .update(secret + CARD_SECRET_SALT)
      .digest("hex");

    const valid = await verifyCardSecret("LEGACY-WRONG", legacyHash);
    expect(valid).toBe(false);
  });

  it("旧哈希与新哈希使用相同 salt（无 salt 不匹配问题）", async () => {
    const secret = "SALT-CHECK";

    const legacyHash = crypto
      .createHash("sha256")
      .update(secret + CARD_SECRET_SALT)
      .digest("hex");

    const bcryptHash = await hashCardSecret(secret);

    // 两种格式都能验证通过
    expect(await verifyCardSecret(secret, legacyHash)).toBe(true);
    expect(await verifyCardSecret(secret, bcryptHash)).toBe(true);
  });
});

describe("isLegacyHash — 新旧格式判定", () => {
  it("bcrypt 哈希返回 false（非旧格式）", async () => {
    const hash = await hashCardSecret("ANY-SECRET");
    expect(isLegacyHash(hash)).toBe(false);
  });

  it("SHA-256 hex 哈希返回 true（旧格式）", () => {
    const legacyHash = crypto
      .createHash("sha256")
      .update("anything" + CARD_SECRET_SALT)
      .digest("hex");
    expect(isLegacyHash(legacyHash)).toBe(true);
  });

  it("用于决定是否需要惰性迁移升级", async () => {
    const secret = "MIGRATION-TEST";

    // 模拟存量旧卡密
    const legacyHash = crypto
      .createHash("sha256")
      .update(secret + CARD_SECRET_SALT)
      .digest("hex");
    expect(isLegacyHash(legacyHash)).toBe(true); // 需要迁移

    // 验证后升级为新 bcrypt 哈希
    const newHash = await hashCardSecret(secret);
    expect(isLegacyHash(newHash)).toBe(false); // 已迁移，无需再升
  });
});
