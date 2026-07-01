import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";
import crypto from "crypto";

const createOrderSchema = z.object({
  productType: z.enum(["VIP_MONTH", "VIP_QUARTER", "VIP_YEAR", "PAID_POST", "CARD_PACKAGE"]),
  productId: z.string().optional(),
  title: z.string().min(1).max(200),
  amount: z.number().min(0.01),
});

function generateOrderNo(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
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
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return ok(
      orders.map((o) => ({
        ...o,
        amount: Number(o.amount),
        payment: o.payment
          ? { ...o.payment, amount: undefined }
          : null,
      })),
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

    const data = parsed.data;
    const orderNo = generateOrderNo();

    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: session.user.id,
        productType: data.productType,
        productId: data.productId || null,
        title: data.title,
        amount: data.amount,
        status: "PENDING",
      },
    });

    return ok({
      id: order.id,
      orderNo: order.orderNo,
      amount: Number(order.amount),
      status: order.status,
    });
  } catch (error) {
    console.error("[Create Order Error]", error);
    return fail("创建订单失败", 50000, 500);
  }
}
