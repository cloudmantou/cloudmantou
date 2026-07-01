import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
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
    };

    // Generate CSV
    const header = "卡号,卡密,类型,数值,状态,批次,使用者,使用时间,过期时间,创建时间";
    const rows = cards.map((c) =>
      [
        c.cardNo,
        c.cardSecret,
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
    const BOM = "﻿"; // Excel UTF-8 BOM

    return new Response(BOM + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=cards-${Date.now()}.csv`,
      },
    });
  } catch (error) {
    console.error("[Export Cards Error]", error);
    return new Response("导出失败", { status: 500 });
  }
}
