import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";
import crypto from "crypto";
import { buildOrderFulfillment } from "@/lib/order-fulfillment";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit-server";
import { CardStockError, reserveCardForOrder } from "@/lib/card-delivery";
import { expireStalePendingOrders, ORDER_PENDING_TTL_MS } from "@/lib/order-lifecycle";
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

/** 每个用户同时持有的未支付卡密订单上限，防止通过挂单长期占住库存 */
const MAX_PENDING_CARD_ORDERS_PER_USER = 3;

/** 支付回调可能略晚于订单过期时间到达，预占卡的有效期额外留出的宽限 */
const CARD_RESERVATION_GRACE_MS = 10 * 60 * 1000;

class PendingCardOrderLimitError extends Error {}

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

    const response = ok(
      orders.map((o) => {
        const fulfillment = buildOrderFulfillment(o);
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
    response.headers.set("Cache-Control", "private, no-store");
    return response;
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

    const limited = await checkRateLimit(
      req,
      { ...RATE_LIMITS.ORDER_CREATE, scope: "order-create" },
      session.user.id
    );
    if (limited) return limited;

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const { productType, productId } = parsed.data;

    // 服务端查价，不信任客户端传入的 title/amount
    let title: string;
    let amount: number;
    let deliverySource: string | undefined;

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
        where: { id: productId, published: true, enabled: true, pointReward: null },
      });
      if (!cardPackage) {
        return fail("卡密商品不存在或未发布", 40400, 404);
      }
      // 先归还超时未付订单的预占卡；挂单上限在下方事务内持用户行锁原子判断。
      await expireStalePendingOrders({ cardPackageId: cardPackage.id });
      const { countActiveCardStock } = await import("@/lib/card-packages");
      const stock = await countActiveCardStock(prisma, cardPackage.id, cardPackage.deliverySource);
      if (stock <= 0) {
        return fail("该卡密商品库存不足", 40000, 400);
      }
      deliverySource = cardPackage.deliverySource;
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

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        if (productType === "CARD_PACKAGE") {
          // 锁住用户行，串行化同一用户的并发下单，使“计数 → 创建 → 预占”整体原子。
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${session.user.id} FOR UPDATE`;
          const pendingCardOrders = await tx.order.count({
            where: { userId: session.user.id, productType: "CARD_PACKAGE", status: "PENDING" },
          });
          if (pendingCardOrders >= MAX_PENDING_CARD_ORDERS_PER_USER) {
            throw new PendingCardOrderLimitError();
          }
        }
        const created = await tx.order.create({
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
        // 卡密订单在下单时即预占一张卡；库存被并发抢光时整笔回滚。
        if (productType === "CARD_PACKAGE" && productId) {
          // 预占卡须在整个可支付窗口（含回调宽限）内有效，避免付款后发现卡已过期。
          const validUntil = new Date(Date.now() + ORDER_PENDING_TTL_MS + CARD_RESERVATION_GRACE_MS);
          await reserveCardForOrder(tx, { id: created.id, productId }, validUntil, ...(deliverySource ? [deliverySource] : []));
        }
        return created;
      });
    } catch (error) {
      if (error instanceof CardStockError) {
        return fail("该卡密商品库存不足", 40000, 400);
      }
      if (error instanceof PendingCardOrderLimitError) {
        return fail("未支付的卡密订单过多，请先完成或等待其过期", 42900, 429);
      }
      throw error;
    }

    return ok({
      id: order.id,
      orderNo: order.orderNo,
      title: order.title,
      amount: Number(order.amount),
      status: order.status,
      productType: order.productType,
      productId: order.productId,
    });
  } catch (error) {
    console.error("[Create Order Error]", error);
    return fail("创建订单失败", 50000, 500);
  }
}
