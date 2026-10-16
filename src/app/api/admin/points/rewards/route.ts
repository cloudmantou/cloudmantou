import type { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireAdmin, requireAdminAndAudit, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { listPointRewards } from "@/lib/feedback-server";
import { feedbackJson, privateOk, feedbackFail } from "@/lib/feedback-request";
const schema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(500), note: z.string().trim().max(500).default(""), type: z.enum(["VIP_DAYS", "PAID_ARTICLE", "BALANCE", "GENERIC"]), value: z.number().int().min(1).max(100000), cost: z.number().int().min(1).max(1000000) }).strict();
export const dynamic = "force-dynamic";
export async function GET() { try { await requireAdmin(); return privateOk(await listPointRewards(true)); } catch (e) { return feedbackFail(e); } }
export async function POST(req: NextRequest) {
  try {
    await requireAdminAndAudit(req, "points.reward.create");
    const p = schema.safeParse(await feedbackJson(req)); if (!p.success) throw new ApiError(p.error.errors[0].message, 42200, 422);
    const d = p.data;
    const reward = await prisma.$transaction(async tx => {
      const pkg = await tx.cardPackage.create({ data: { name: d.name, slug: `points-${randomUUID()}`, description: d.description, redemptionNote: d.note, cardType: d.type, cardValue: d.value, price: 0, published: false, enabled: true, badge: "积分" } });
      return tx.pointReward.create({ data: { packageId: pkg.id, cost: d.cost, enabled: false } });
    });
    return privateOk({ id: reward.id });
  } catch (e) { return feedbackFail(e); }
}
