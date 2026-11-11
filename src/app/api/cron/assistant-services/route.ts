import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readIPAToolStatus } from "@/lib/assistant-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization") || "";
  const headers = { "Cache-Control": "private, no-store" };
  const target = `Bearer ${expected}`;
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(target) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(target))) return new Response(null, { status: 401, headers });
  try {
    const regions = await readIPAToolStatus();
    await prisma.$transaction(regions.map(({ data, ...sample }) => prisma.assistantServiceSnapshot.create({ data: { region: sample.region, reachable: sample.reachable, summary: { ...sample, ...(data ? { auth: data.auth, busy: data.busy || "", artifacts: data.artifacts, startedAt: data.requests?.startedAt || null, counts: data.requests?.counts || {} } : {}) } } })));
    // Deterministic cleanup; expiry is also checked on every plist request.
    await prisma.assistantInstallManifest.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await prisma.assistantServiceSnapshot.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
    return Response.json({ ok: true, regions: regions.map(r => ({ region: r.region, reachable: r.reachable })) }, { headers });
  } catch { return Response.json({ ok: false }, { status: 503, headers }); }
}
