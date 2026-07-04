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
import { encryptCardSecret } from "@/lib/card-secret-storage";
import { z } from "zod";

export const dynamic = "force-dynamic";

const generateSchema = z.object({
  packageId: z.string().min(1, "请选择关联商品"),
  type: z.enum(["VIP_DAYS", "PAID_ARTICLE", "BALANCE", "GENERIC"]).optional(),
  note: z.string().max(500).optional(),
  value: z.number().int().min(1, "数值必须大于0").optional(),
  count: z.number().int().min(1).max(500, "单次最多生成500张").optional(),
  expireDays: z.number().int().min(1).max(3650).optional(),
  batchNo: z.string().max(50).optional(),
  prefix: z.string().max(10).optional(),
  format: z.enum(["standard", "uuid", "numeric", "custom"]).optional(),
  importLines: z.array(z.string().max(500)).max(500).optional(),
  importMode: z.enum(["secrets", "pairs"]).optional(),
  autoActivate: z.boolean().optional(),
});

/** 默认每行一个卡密，卡号由系统生成；pairs 模式按「卡号,卡密」解析 */
function parseImportLine(
  line: string,
  mode: "secrets" | "pairs"
): { cardNo?: string; secret: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (mode === "pairs") {
    const delimiterAt = trimmed.search(/[,|\t]/);
    if (delimiterAt > 0) {
      const cardNo = trimmed.slice(0, delimiterAt).trim();
      const secret = trimmed.slice(delimiterAt + 1).replace(/^[,|\t]+/, "").trim();
      if (cardNo && secret) return { cardNo, secret };
    }
    return { secret: trimmed };
  }

  return { secret: trimmed };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || undefined;
    const packageId = searchParams.get("packageId") || undefined;
    const excludeType = searchParams.get("excludeType") || undefined;
    const batchNo = searchParams.get("batchNo") || undefined;
    const search = searchParams.get("search")?.trim() || undefined;

    const where: any = {
      ...(type && { type }),
      ...(packageId && { packageId }),
      ...(excludeType && { type: { not: excludeType } }),
      ...(batchNo && { batchNo }),
      ...(search && {
        OR: [
          { cardNo: { contains: search } },
          { batchNo: { contains: search } },
        ],
      }),
      ...(status === "ACTIVE" && { status: "ACTIVE", orderId: null }),
      ...(status === "USED" && {
        OR: [{ status: "USED" }, { orderId: { not: null } }],
      }),
      ...(status && !["ACTIVE", "USED"].includes(status) && { status }),
    };

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, nickname: true } },
          package: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.card.count({ where }),
    ]);

    const safe = cards.map((c) => ({
      id: c.id,
      cardNo: c.cardNo,
      type: c.type,
      value: c.value,
      status: c.orderId ? "SOLD" : c.status,
      batchNo: c.batchNo,
      packageId: c.packageId,
      packageName: c.package?.name || null,
      orderId: c.orderId,
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
      packageId,
      count = 10,
      expireDays,
      batchNo,
      prefix,
      format,
      importLines,
      importMode = "secrets",
      autoActivate = true,
      note,
    } = parsed.data;

    const pkg = await prisma.cardPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      return fail("关联商品不存在", 40400, 404);
    }

    const type = pkg.cardType;
    const value = pkg.cardValue;
    const batch = batchNo || `BATCH-${Date.now().toString(36).toUpperCase()}`;
    const expireAt =
      expireDays && expireDays > 0
        ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000)
        : null;

    const cardFormat = (format || "standard") as CardFormat;
    const genOptions = { prefix, format: cardFormat };

    const cards: Array<{ cardNo: string; secret: string; hash: string; enc: string }> = [];
    const cardNos = new Set<string>();
    const cardSecrets = new Set<string>();

    const addCard = async (cardNo: string, secret?: string) => {
      const plainSecret = secret?.trim() || generateCardSecret();
      if (!plainSecret || cardSecrets.has(plainSecret)) return false;
      cardSecrets.add(plainSecret);

      let normalized = cardNo?.trim().toUpperCase();
      if (!normalized) {
        do {
          normalized = generateCardNo(genOptions);
        } while (cardNos.has(normalized));
      }
      if (cardNos.has(normalized)) return false;

      const existing = await prisma.card.findFirst({
        where: { cardNo: normalized },
        select: { id: true },
      });
      if (existing) return false;

      cardNos.add(normalized);

      const hash = await hashCardSecret(plainSecret);
      const enc = encryptCardSecret(plainSecret);
      cards.push({ cardNo: normalized, secret: plainSecret, hash, enc });
      return true;
    };

    if (importLines && importLines.length > 0) {
      for (const line of importLines) {
        const parsedLine = parseImportLine(line, importMode);
        if (!parsedLine?.secret) continue;
        await addCard(parsedLine.cardNo || "", parsedLine.secret);
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

    await prisma.card.createMany({
      data: cards.map((c) => ({
        cardNo: c.cardNo,
        cardSecretHash: c.hash,
        cardSecretEnc: c.enc,
        type,
        value,
        packageId,
        status: autoActivate ? ("ACTIVE" as const) : ("DISABLED" as const),
        batchNo: batch,
        expireAt,
        note: note?.trim() || null,
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
