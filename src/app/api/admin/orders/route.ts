import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") || "20"));
    const status = searchParams.get("status") || undefined;
    const q = searchParams.get("q") || undefined;

    const where: any = {
      ...(status && { status }),
      ...(q && {
        OR: [
          { orderNo: { contains: q } },
          { title: { contains: q } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, nickname: true, email: true } },
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
      })),
      { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    );
  } catch (error) {
    console.error("[Admin Orders List Error]", error);
    return fail("获取订单列表失败", 50000, 500);
  }
}
