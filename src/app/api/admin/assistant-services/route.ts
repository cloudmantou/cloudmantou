import { requireAdmin, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { readIPAToolStatus } from "@/lib/assistant-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    await requireAdmin();
    const [regions, manifests, snapshots] = await Promise.all([
      readIPAToolStatus(),
      prisma.assistantInstallManifest.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, bundleId: true, version: true, title: true, createdAt: true, expiresAt: true, fetchedAt: true, fetchCount: true, signatureVerified: true } }),
      prisma.assistantServiceSnapshot.findMany({ take: 120, orderBy: { createdAt: "desc" } }),
    ]);
    return Response.json({ code: 0, data: { regions, manifests, snapshots } }, { headers });
  } catch (error) {
    return Response.json({ message: error instanceof ApiError ? error.message : "服务监控暂不可用" }, { status: error instanceof ApiError ? error.status : 503, headers });
  }
}
