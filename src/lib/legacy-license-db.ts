import { PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";
import { ApiError } from "@/lib/api-error";
const shared = globalThis as unknown as { appLicenseDb?: PrismaClient };
export function licenseDb() {
  if (!process.env.LEGACY_CARD_DATABASE_URL) throw new ApiError("应用授权数据库尚未配置", 50300, 503);
  return shared.appLicenseDb ??= new PrismaClient({ datasources: { db: { url: process.env.LEGACY_CARD_DATABASE_URL } } });
}
export function generateLicenseKey() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array.from({ length: 16 }, () => alphabet[randomInt(alphabet.length)]).join("");
}
