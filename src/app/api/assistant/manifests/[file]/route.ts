import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
async function manifest(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-f0-9]{32}\.plist$/.test(file)) return new Response(null, { status: 404, headers });
  try {
    const record = await prisma.assistantInstallManifest.findUnique({ where: { id: file.slice(0, -6) } });
    if (!record || record.expiresAt <= new Date()) return new Response(null, { status: 404, headers });
    const xml = decryptSecret(record.encryptedPlist);
    if (!xml.startsWith("<?xml")) return new Response(null, { status: 503, headers });
    if (req.method !== "HEAD") await prisma.assistantInstallManifest.update({ where: { id: record.id }, data: { fetchedAt: new Date(), fetchCount: { increment: 1 } } });
    return new Response(req.method === "HEAD" ? null : xml, { headers: { ...headers, "Content-Type": "application/x-plist; charset=utf-8" } });
  } catch { return new Response(null, { status: 503, headers }); }
}
export const GET = manifest;
export const HEAD = manifest;
