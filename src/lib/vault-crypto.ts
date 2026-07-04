import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";

export function encryptVaultField(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return encryptSecret(value.trim());
}

export function decryptVaultField(value: string | null | undefined): string {
  if (!value) return "";
  return decryptSecret(value);
}

export function hasVaultSecret(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}