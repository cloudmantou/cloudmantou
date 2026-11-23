import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { verifyAssertion, verifyAttestation } from "node-app-attest";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

const appBundleID = "com.mantou.mtsk";
const challengeLifetime = 120_000;
const prefix = "mtsk.speech.attest.";

const nonce = z.string().regex(/^\d{13}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/);
const keyID = z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
const proof = z.string().min(1).max(13_000).regex(/^[A-Za-z0-9+/]+={0,2}$/);
const requestFields = { challenge: nonce, keyId: keyID };
export const appAttestRequest = z.union([
  z.object({ ...requestFields, attestation: proof }).strict(),
  z.object({ ...requestFields, assertion: proof }).strict(),
]);

type AppAttestRequest = z.infer<typeof appAttestRequest>;
const savedKey = z.object({ publicKey: z.string().min(1), signCount: z.number().int().nonnegative() });

function resources() {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  const teamIdentifier = process.env.MTSK_APP_ATTEST_TEAM_ID?.trim();
  if (!secret || !teamIdentifier || !/^[A-Z0-9]{10}$/.test(teamIdentifier)) {
    throw new ApiError("官方模型验证暂不可用", 50318, 503);
  }
  return { secret, teamIdentifier };
}

function invalidProof() {
  return new ApiError("App 验证失败，请重试", 40118, 401);
}

function challengeSignature(content: string, secret: string) {
  return createHmac("sha256", secret).update(prefix).update(content).digest();
}

export function createConfigChallenge() {
  const { secret } = resources();
  const raw = `${Date.now()}.${randomBytes(32).toString("base64url")}`;
  return raw + "." + challengeSignature(raw, secret).toString("base64url");
}

function verifyConfigChallenge(challenge: string, secret: string) {
  const [timestamp, random, signature] = challenge.split(".");
  const age = Date.now() - Number(timestamp);
  const supplied = Buffer.from(signature, "base64url");
  const expected = challengeSignature(timestamp + "." + random, secret);
  if (age < 0 || age > challengeLifetime || supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)) throw invalidProof();
}

export async function verifyConfigClient(input: AppAttestRequest) {
  const { secret, teamIdentifier } = resources();
  verifyConfigChallenge(input.challenge, secret);

  const registrationKey = prefix + createHash("sha256").update(input.keyId).digest("hex");
  const common = { bundleIdentifier: appBundleID, teamIdentifier };
  if ("attestation" in input) {
    let publicKey: string;
    try {
      ({ publicKey } = await verifyAttestation({
        ...common,
        challenge: input.challenge,
        keyId: input.keyId,
        attestation: Buffer.from(input.attestation, "base64"),
        allowDevelopmentEnvironment: process.env.NODE_ENV !== "production",
      }));
    } catch {
      throw invalidProof();
    }
    // A key can register only once, even if the original attestation is replayed.
    const created = await prisma.siteSetting.createMany({
      data: [{ key: registrationKey, value: JSON.stringify({ publicKey, signCount: 0 }), type: "internal" }],
      skipDuplicates: true,
    });
    if (created.count !== 1) throw invalidProof();
    return;
  }

  const record = await prisma.siteSetting.findUnique({ where: { key: registrationKey }, select: { value: true } });
  if (!record) throw new ApiError("App 安装验证已过期", 40119, 401);
  const existing = savedKey.parse(JSON.parse(record.value));
  let signCount: number;
  try {
    ({ signCount } = await verifyAssertion({
      ...common,
      ...existing,
      payload: input.challenge,
      assertion: Buffer.from(input.assertion, "base64"),
    }));
  } catch {
    throw invalidProof();
  }
  if (!Number.isSafeInteger(signCount) || signCount <= existing.signCount) throw invalidProof();
  const updated = await prisma.siteSetting.updateMany({
    where: { key: registrationKey, value: record.value },
    data: { value: JSON.stringify({ ...existing, signCount }) },
  });
  if (updated.count !== 1) throw invalidProof();
}
