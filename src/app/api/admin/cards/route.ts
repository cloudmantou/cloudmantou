import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";
import crypto from "crypto";

const generateSchema = z.object({
  type: z.enum(["VIP_DAYS", "PAID_ARTICLE", "BALANCE"]),
  value: z.number().int().min(1, "数值必须大于0"),
  count: z.number().int().min(1).max(500, "单次最多生成500张"),
  expireDays: z.number().int().min(1).max(3650).optional(),
  batchNo: z.string().max(50).optional(),
});

function generateCardNo(): string {
  const prefix = "CM";
  const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function generateSecret(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
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

    return ok(cards, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("[Admin Cards List Error]", error);
    return fail("获取卡密列表失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
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

    // Generate cards in batches to avoid unique collisions
    const cards: Array<{ cardNo: string; cardSecret: string }> = [];
    const cardNos = new Set<string>();
    const secrets = new Set<string>();

    for (let i = 0; i < count; i++) {
      let cardNo = generateCardNo();
      let secret = generateSecret();
      // Ensure uniqueness within batch
      while (cardNos.has(cardNo)) cardNo = generateCardNo();
      while (secrets.has(secret)) secret = generateSecret();
      cardNos.add(cardNo);
      secrets.add(secret);
      cards.push({ cardNo, cardSecret: secret });
    }

    // Bulk insert
    await prisma.card.createMany({
      data: cards.map((c) => ({
        cardNo: c.cardNo,
        cardSecret: c.cardSecret,
        type,
        value,
        status: "ACTIVE" as const,
        batchNo: batch,
        expireAt,
      })),
    });

    return ok({
      batchNo: batch,
      count: cards.length,
      cards: cards.map((c) => ({ cardNo: c.cardNo, cardSecret: c.cardSecret })),
    });
  } catch (error) {
    console.error("[Admin Generate Cards Error]", error);
    return fail("生成卡密失败", 50000, 500);
  }
}
