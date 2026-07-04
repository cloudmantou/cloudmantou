import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";
import crypto from "crypto";
import { decryptCardSecret } from "@/lib/card-secret-storage";
import {
  isMembershipProductAvailable,
  type MembershipProductType,
} from "@/lib/membership-catalog";

// ===== 服务端价格目录（不可被客户端覆盖）=====
const PRODUCT_CATALOG: Record<string, { title: string; price: number }> = {
  VIP_MONTH:   { title: "月度会员", price: 29 },
  VIP_QUARTER: { title: "季度会员", price: 69 },
  VIP_YEAR:    { title: "年度会员", price: 199 },
};

const createOrderSchema = z.object({
  productType: z.enum(["VIP_MONTH", "VIP_QUARTER", "VIP_YEAR", "PAID_POST", "CARD_PACKAGE"]),
  productId: z.string().optional(),
});

function buildFulfillment(order: {
  productType: string;
  status: string;
  delivery: { cardNo: string; cardSecretEnc: string; status: string } | null;
}) {
  if (order.status !== "PAID") {
    return { kind: "none" as const, message: null, card: null };
  }

  if (order.productType === "CARD_PACKAGE") {
    if (order.delivery) {
      return {
        kind: "card" as const,
        message: "卡密已发放，请妥善保存",
        card: {
          cardNo: order.delivery.cardNo,
          cardSecret: decryptCardSecret(order.delivery.cardSecretEnc),
        },
      };
    }
    return { kind: "card" as const, message: "卡密发放中，请稍后刷新", card: null };
  }

  if (
    order.productType === "VIP_MONTH" ||
    order.productType === "VIP_QUARTER" ||
    order.productType === "VIP_YEAR"
  ) {
    return {
      kind: "membership" as const,
      message: "会员已自动开通，无需卡密",
      card: null,
    };
  }

  if (order.productType === "PAID_POST") {
    return {
      kind: "article" as const,
      message: "付费文章已解锁",
      card: null,
    };
  }

  return { kind: "none" as const, message: null, card: null };
}

function generateOrderNo(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ORD${datePart}${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") || "10"));
    const status = searchParams.get("status") || undefined;

    const where: any = {
      userId: session.user.id,
      ...(status && { status }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          payment: { select: { channel: true, status: true, tradeNo: true } },
          delivery: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return ok(
      orders.map((o) => {
        const fulfillment = buildFulfillment(o);
        return {
          id: o.id,
          orderNo: o.orderNo,
          title: o.title,
          amount: Number(o.amount),
          status: o.status,
          productType: o.productType,
          productId: o.productId,
          createdAt: o.createdAt,
          paidAt: o.paidAt,
          payment: o.payment ? { ...o.payment } : null,
          fulfillment,
        };
      }),
      { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    );
  } catch (error) {
    console.error("[Orders List Error]", error);
    return fail("获取订单列表失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("请先登录", 40100, 401);
    }

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { productType, productId } = parsed.data;

    // 服务端查价，不信任客户端传入的 title/amount
    let title: string;
    let amount: number;

    if (productType === "PAID_POST") {
      if (!productId) {
        return fail("付费文章需要指定文章 ID", 40000, 400);
      }
      const post = await prisma.post.findUnique({
        where: { id: productId, status: "PAID_ONLY" },
        include: { paidContent: { select: { price: true } } },
      });
      if (!post || !post.paidContent) {
        return fail("文章不存在或非付费文章", 40400, 404);
      }
      title = post.title;
      amount = Number(post.paidContent.price);
    } else if (productType === "CARD_PACKAGE") {
      if (!productId) {
        return fail("卡密套餐需要指定套餐 ID", 40000, 400);
      }
      const cardPackage = await prisma.cardPackage.findFirst({
        where: { id: productId, published: true, enabled: true },
      });
      if (!cardPackage) {
        return fail("卡密商品不存在或未发布", 40400, 404);
      }
      const { countActiveCardStock } = await import("@/lib/card-packages");
      const stock = await countActiveCardStock(prisma, cardPackage.id);
      if (stock <= 0) {
        return fail("该卡密商品库存不足", 40000, 400);
      }
      title = cardPackage.name;
      amount = Number(cardPackage.price);
    } else {
      const catalog = PRODUCT_CATALOG[productType];
      if (!catalog) {
        return fail("未知商品类型", 40000, 400);
      }
      if (productType === "VIP_MONTH" || productType === "VIP_YEAR") {
        const available = await isMembershipProductAvailable(
          productType as MembershipProductType
        );
        if (!available) {
          return fail("该会员套餐未上架", 40000, 400);
        }
      }
      title = catalog.title;
      amount = catalog.price;
    }

    if (amount <= 0) {
      return fail("价格异常", 40000, 400);
    }

    const orderNo = generateOrderNo();

    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: session.user.id,
        productType,
        productId: productId || null,
        title,
        amount,
        status: "PENDING",
      },
    });

    return ok({
      id: order.id,
      orderNo: order.orderNo,
      title: order.title,
      amount: Number(order.amount),
      status: order.status,
    });
  } catch (error) {
    console.error("[Create Order Error]", error);
    return fail("创建订单失败", 50000, 500);
  }
}
