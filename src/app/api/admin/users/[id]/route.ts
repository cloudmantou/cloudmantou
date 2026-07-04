import { auth } from "@/lib/auth";
import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";
import { auditAdminAction } from "@/lib/admin-audit-log";

// 不允许把任何人提升为 ADMIN（包括自己）；也不允许修改自己。
// 调用方是 EDITOR 时只能改 vipLevel（虽然 EDITOR 当前不通过 requireAdmin，
// 但中间件只放行 ADMIN，所以 vipLevel 也只有管理员可改）。
const updateSchema = z
  .object({
    role: z.enum(["USER", "EDITOR"]).optional(),
    vipLevel: z.number().int().min(0).max(10).optional(),
  })
  .strict()
  .refine((d) => d.role !== undefined || d.vipLevel !== undefined, {
    message: "至少需要修改 role 或 vipLevel 之一",
  });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    if (id === session.user.id) {
      return fail("不能修改自己的角色或 VIP", 40900, 409);
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return fail("用户不存在", 40400, 404);
    if (user.role === "ADMIN") {
      return fail("不能修改其他管理员", 40900, 409);
    }

    // 仅当有值时才更新对应字段
    const data: { role?: "USER" | "EDITOR"; vipLevel?: number; vipExpireAt?: Date | null } = {};
    if (parsed.data.role !== undefined) data.role = parsed.data.role;
    if (parsed.data.vipLevel !== undefined) {
      data.vipLevel = parsed.data.vipLevel;
      // VIP 升降同时设置 30 天有效期；0 表示免费（清空过期时间）
      data.vipExpireAt = parsed.data.vipLevel > 0
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    await auditAdminAction(req, session.user.id, "user.update", {
      targetType: "user",
      targetId: id,
      detail: JSON.stringify(data),
    });

    return ok({
      id: updated.id,
      role: updated.role,
      vipLevel: updated.vipLevel,
      vipExpireAt: updated.vipExpireAt,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Update User Error]", error);
    return fail("更新用户失败", 50000, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    if (id === session.user.id) {
      return fail("不能删除自己的账户", 40900, 409);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return fail("用户不存在", 40400, 404);
    if (user.role === "ADMIN") return fail("不能删除管理员账户", 40900, 409);

    await prisma.user.delete({ where: { id } });
    await auditAdminAction(req, session.user.id, "user.delete", {
      targetType: "user",
      targetId: id,
      detail: user.username,
    });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Delete User Error]", error);
    return fail("删除用户失败", 50000, 500);
  }
}
