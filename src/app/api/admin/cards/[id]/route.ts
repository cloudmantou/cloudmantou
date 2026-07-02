import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
    const card = await prisma.card.findUnique({ where: { id: id } });
    if (!card) {
      return fail("卡密不存在", 40400, 404);
    }
    if (card.status === "USED") {
      return fail("已使用的卡密不能修改状态", 40000, 400);
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    await prisma.card.update({
      where: { id: id },
      data: { status: parsed.data.status },
    });

    return ok({ id: id, status: parsed.data.status });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Update Card Error]", error);
    return fail("更新卡密状态失败", 50000, 500);
  }
}
