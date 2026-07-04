import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { fail } from "@/lib/api-response";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

/**
 * 卡密导出 CSV
 * 卡密哈希不可逆，导出只包含卡号。明文仅在生成时返回一次。
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = req.nextUrl;
    const batchNo = searchParams.get("batchNo") || undefined;
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || undefined;

    const where: any = {
      ...(batchNo && { batchNo }),
      ...(type && { type }),
      ...(status && { status }),
    };

    const cards = await prisma.card.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const TYPE_LABELS: Record<string, string> = {
      VIP_DAYS: "VIP天数",
      PAID_ARTICLE: "付费文章",
      BALANCE: "余额",
      GENERIC: "外部/通用",
    };

    const header = "卡号,类型,数值,状态,批次,使用者,使用时间,过期时间,创建时间";
    const rows = cards.map((c) =>
      [
        c.cardNo,
        TYPE_LABELS[c.type] || c.type,
        c.value,
        c.status,
        c.batchNo || "",
        c.usedBy || "",
        c.usedAt?.toISOString() || "",
        c.expireAt?.toISOString() || "",
        c.createdAt.toISOString(),
      ].join(",")
    );

    const csv = [header, ...rows].join("\n");
    const BOM = "﻿";

    return new Response(BOM + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=cards-${Date.now()}.csv`,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Export Cards Error]", error);
    return fail("导出失败", 50000, 500);
  }
}
