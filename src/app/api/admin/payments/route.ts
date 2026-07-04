import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { auditAdminAction } from "@/lib/admin-audit-log";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    await auditAdminAction(req, session.user.id, "payments.list");

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const status = searchParams.get("status") || undefined;
    const channel = searchParams.get("channel") || undefined;

    const where: any = {
      ...(status && { status }),
      ...(channel && { channel }),
    };

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              orderNo: true,
              title: true,
              user: { select: { username: true, nickname: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    return ok(items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Payments List Error]", error);
    return fail("获取支付记录失败", 50000, 500);
  }
}
