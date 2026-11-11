import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secret-crypto";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit-server";
import { MANIFEST_TTL_MS, ManifestInputError, manifestBaseURL, parseManifestInput, renderManifest, validLegacySignature } from "@/lib/assistant-manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export async function GET(req: Request) {
  try {
    const limited = await checkRateLimit(req, { limit: 30, windowMs: 60000, scope: "assistant-manifest" });
    if (limited) return limited;
    const input = parseManifestInput(new URL(req.url).searchParams, getClientIP(req));
    const id = randomUUID().replaceAll("-", "");
    await prisma.assistantInstallManifest.create({ data: {
      id, bundleId: input.bundleId, version: input.version, title: input.title,
      encryptedPlist: encryptSecret(renderManifest(input)),
      signatureVerified: validLegacySignature(input.values, process.env.ASSISTANT_LEGACY_HMAC_KEY),
      expiresAt: new Date(Date.now() + MANIFEST_TTL_MS),
    } });
    const manifestURL = `${manifestBaseURL()}${id}.plist`;
    // Legacy PHP envelope is deliberately not wrapped in the blog API format.
    return Response.json({ manifest_url: manifestURL, itms: `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestURL)}`, nonce: input.nonce, ipa_url: input.ipaUrl }, { headers });
  } catch (error) {
    const badInput = error instanceof ManifestInputError || error instanceof TypeError;
    return Response.json({ error: true, message: badInput ? "安装参数无效，请重新发起安装" : "安装清单暂不可用，请稍后重试", timestamp: new Date().toISOString() }, { status: badInput ? 400 : 503, headers });
  }
}
