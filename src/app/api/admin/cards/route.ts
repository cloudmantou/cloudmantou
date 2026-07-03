import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireAdmin, ApiError } from "@/lib/guards";
import {
  hashCardSecret,
  generateCardNo,
  generateCardSecret,
  type CardFormat,
} from "@/lib/card-crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const generateSchema = z.object({
  type: z.enum(["VIP_DAYS", "PAID_ARTICLE", "BALANCE"]),
  value: z.number().int().min(1, "数值必须大于0"),
  count: z.number().int().min(1).max(500, "单次最多生成500张").optional(),
  expireDays: z.number().int().min(1).max(3650).optional(),
  batchNo: z.string().max(50).optional(),
  prefix: z.string().max(10).optional(),
  format: z.enum(["standard", "uuid", "numeric", "custom"]).optional(),
  importLines: z.array(z.string().max(120)).max(500).optional(),
  autoActivate: z.boolean().optional(),
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
    const search = searchParams.get("search")?.trim() || undefined;

    const where: any = {
      ...(type && { type }),
      ...(status && { status }),
      ...(batchNo && { batchNo }),
      ...(search && {
        OR: [
          { cardNo: { contains: search } },
          { batchNo: { contains: search } },
        ],
      }),
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

    const {
      type,
      value,
      count = 10,
      expireDays,
      batchNo,
      prefix,
      format,
      importLines,
      autoActivate = true,
    } = parsed.data;
    const batch = batchNo || `BATCH-${Date.now().toString(36).toUpperCase()}`;
    const expireAt =
      expireDays && expireDays > 0
        ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000)
        : null;

    const cardFormat = (format || "standard") as CardFormat;
    const genOptions = { prefix, format: cardFormat };

    const cards: Array<{ cardNo: string; secret: string; hash: string }> = [];
    const cardNos = new Set<string>();

    const addCard = async (cardNo: string, secret?: string) => {
      const normalized = cardNo.trim().toUpperCase();
      if (!normalized || cardNos.has(normalized)) return false;
      cardNos.add(normalized);
      const plainSecret = secret?.trim() || generateCardSecret();
      const hash = await hashCardSecret(plainSecret);
      cards.push({ cardNo: normalized, secret: plainSecret, hash });
      return true;
    };

    if (importLines && importLines.length > 0) {
      for (const line of importLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [no, secret] = trimmed.split(/[,|\s]+/).map((s) => s.trim());
        await addCard(no, secret);
      }
    } else {
      for (let i = 0; i < count; i++) {
        let cardNo = generateCardNo(genOptions);
        while (cardNos.has(cardNo)) cardNo = generateCardNo(genOptions);
        await addCard(cardNo);
      }
    }

    if (cards.length === 0) {
      return fail("没有可生成的卡密", 42200, 422);
    }

    // 批量插入（只存哈希）
    await prisma.card.createMany({
      data: cards.map((c) => ({
        cardNo: c.cardNo,
        cardSecretHash: c.hash,
        type,
        value,
        status: autoActivate ? ("ACTIVE" as const) : ("DISABLED" as const),
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
