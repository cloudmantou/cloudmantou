import { createHmac, timingSafeEqual } from "crypto";

export const VAULT_UNLOCK_COOKIE = "vault_unlock";
export const VAULT_UNLOCK_TTL_MS = 15 * 60 * 1000;

function signingKey(): string {
  const key = process.env.AUTH_SECRET?.trim();
  if (!key) throw new Error("AUTH_SECRET is required for vault session");
  return key;
}

export function createVaultUnlockToken(userId: string, now = Date.now()): string {
  const exp = now + VAULT_UNLOCK_TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", signingKey()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyVaultUnlockToken(
  token: string | undefined | null,
  userId: string,
  now = Date.now()
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [uid, expRaw, sig] = parts;
  if (uid !== userId) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now) return false;

  const payload = `${uid}.${expRaw}`;
  const expected = createHmac("sha256", signingKey()).update(payload).digest("hex");

  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function vaultUnlockCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: new Date(expiresAt),
  };
}