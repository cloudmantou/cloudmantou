import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin, ApiError } from "@/lib/guards";
import { hashCardSecret, generateCardNo, generateCardSecret } from "@/lib/card-crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const generateSchema = z.object({
  type: z.enum(["VIP_DAYS", "PAID_ARTICLE", "BALANCE"]),
  value: z.number().int().min(1, "数值必须大于0"),
  count: z.number().int().min(1).max(500, "单次最多生成500张"),
  expireDays: z.number().int().min(1).max(3650).optional(),
  batchNo: z.string().max(50).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || undefined;
    const batchNo = searchParams.get("batchNo") || undefined;

    const where: any = {
      ...(type && { type }),
      ...(status && { status }),
      ...(batchNo && { batchNo }),
    };

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, nickname: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.card.count({ where }),
    ]);

    // 不返回哈希值，只返回卡号和脱敏信息
    const safe = cards.map((c) => ({
      id: c.id,
      cardNo: c.cardNo,
      type: c.type,
      value: c.value,
      status: c.status,
      batchNo: c.batchNo,
      usedBy: c.usedBy,
      usedAt: c.usedAt,
      expireAt: c.expireAt,
      createdAt: c.createdAt,
      user: c.user,
    }));

    return ok(safe, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Cards List Error]", error);
    return fail("获取卡密列表失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { type, value, count, expireDays, batchNo } = parsed.data;
    const batch = batchNo || `BATCH-${Date.now().toString(36).toUpperCase()}`;
    const expireAt = expireDays
      ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000)
      : null;

    // 生成卡密，只在本次返回明文
    const cards: Array<{ cardNo: string; secret: string; hash: string }> = [];
    const cardNos = new Set<string>();

    for (let i = 0; i < count; i++) {
      let cardNo = generateCardNo();
      while (cardNos.has(cardNo)) cardNo = generateCardNo();
      cardNos.add(cardNo);

      const secret = generateCardSecret();
      const hash = hashCardSecret(secret);
      cards.push({ cardNo, secret, hash });
    }

    // 批量插入（只存哈希）
    await prisma.card.createMany({
      data: cards.map((c) => ({
        cardNo: c.cardNo,
        cardSecretHash: c.hash,
        type,
        value,
        status: "ACTIVE" as const,
        batchNo: batch,
        expireAt,
      })),
    });

    // 返回明文卡密（仅此一次）
    return ok({
      batchNo: batch,
      count: cards.length,
      cards: cards.map((c) => ({ cardNo: c.cardNo, cardSecret: c.secret })),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Generate Cards Error]", error);
    return fail("生成卡密失败", 50000, 500);
  }
}
