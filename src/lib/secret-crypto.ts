import crypto from "crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

const SETTINGS_ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
if (!SETTINGS_ENCRYPTION_KEY) {
  throw new Error(
    "SETTINGS_ENCRYPTION_KEY is required — set it in .env (generate with: openssl rand -hex 32)"
  );
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
  return crypto.createHash("sha256").update(SETTINGS_ENCRYPTION_KEY!, "utf8").digest();
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext || plaintext.includes("••••") || isEncryptedSecret(plaintext)) {
    return plaintext;
  }

  const trimmed = plaintext.trim();
  if (!trimmed) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `${PREFIX}${payload}`;
}

export function decryptSecret(value: string): string {
  if (!value || !isEncryptedSecret(value)) return value;

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