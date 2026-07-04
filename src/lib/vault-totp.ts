import { authenticator } from "otplib";

authenticator.options = { window: 1 };

export function getVaultTotpSecret(): string | null {
  const secret = process.env.VAULT_TOTP_SECRET?.trim();
  return secret || null;
}

export function isVaultTotpConfigured(): boolean {
  return Boolean(getVaultTotpSecret());
}

export function verifyVaultTotp(code: string): boolean {
  const secret = getVaultTotpSecret();
  if (!secret) return false;
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  return authenticator.check(normalized, secret);
}

export function generateVaultTotpUri(label = "cloudmantou-vault"): string | null {
  const secret = getVaultTotpSecret();
  if (!secret) return null;
  return authenticator.keyuri(label, "CloudMantou", secret);
}