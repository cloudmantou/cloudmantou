import crypto from "crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function requireSettingsEncryptionKey(): string {
  const key = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY is required — set it in .env (generate with: openssl rand -hex 32)"
    );
  }
  return key;
}

const SENSITIVE_GATEWAY_FIELDS = new Set([
  "privateKey",
  "publicKey",
  "apiV3Key",
  "apiKey",
  "secretKey",
  "webhookSecret",
  "key",
]);

function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(requireSettingsEncryptionKey(), "utf8").digest();
}

export function isEncryptedSecret(value: string): boolean {
  if (!value.startsWith(PREFIX)) return false;

  const encoded = value.slice(PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;

  try {
    const payload = Buffer.from(encoded, "base64");
    if (payload.length < IV_BYTES + 16 + 1) return false;
    return (
      payload.toString("base64").replace(/=+$/, "") ===
      encoded.replace(/=+$/, "")
    );
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.includes("••••")) {
    throw new Error("Masked secret placeholders cannot be persisted");
  }

  const trimmed = plaintext.trim();
  if (!trimmed) return plaintext;
  if (isEncryptedSecret(trimmed)) return trimmed;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `${PREFIX}${payload}`;
}

export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value;
  if (!isEncryptedSecret(value)) {
    console.error("[secret-crypto] invalid encrypted payload");
    return "";
  }

  const key = getEncryptionKey();
  try {
    const payload = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = payload.subarray(0, IV_BYTES);
    const tag = payload.subarray(IV_BYTES, IV_BYTES + 16);
    const ciphertext = payload.subarray(IV_BYTES + 16);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[secret-crypto] decrypt failed", err);
    return "";
  }
}

export function encryptGatewaySecrets(
  gateways: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const next: Record<string, Record<string, unknown>> = {};
  for (const [gatewayId, cfg] of Object.entries(gateways)) {
    const encryptedCfg: Record<string, unknown> = { ...cfg };
    for (const [field, value] of Object.entries(cfg)) {
      if (SENSITIVE_GATEWAY_FIELDS.has(field) && typeof value === "string" && value) {
        encryptedCfg[field] = encryptSecret(value);
      }
    }
    next[gatewayId] = encryptedCfg;
  }
  return next;
}

export function decryptGatewaySecrets(
  gateways: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const next: Record<string, Record<string, unknown>> = {};
  for (const [gatewayId, cfg] of Object.entries(gateways)) {
    const decryptedCfg: Record<string, unknown> = { ...cfg };
    for (const [field, value] of Object.entries(cfg)) {
      if (SENSITIVE_GATEWAY_FIELDS.has(field) && typeof value === "string" && value) {
        decryptedCfg[field] = decryptSecret(value);
      }
    }
    next[gatewayId] = decryptedCfg;
  }
  return next;
}
