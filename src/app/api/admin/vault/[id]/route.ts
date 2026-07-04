import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { buildVaultWriteData, toVaultDetail, toVaultListItem } from "@/lib/vault";
import { auditAdminAction } from "@/lib/admin-audit-log";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(["ACCOUNT", "SECRET", "NOTE"]).optional(),
  account: z.string().max(500).optional().nullable(),
  secret: z.string().max(8_000).optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal("")),
  content: z.string().max(16_384).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
  pinned: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
    const row = await prisma.vaultEntry.findUnique({ where: { id } });
    if (!row) {
      return fail("记录不存在", 40400, 404);
    }
    return ok(toVaultDetail(row));
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Vault Detail Error]", error);
    return fail("获取详情失败", 50000, 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await requireAdmin();
    const existing = await prisma.vaultEntry.findUnique({ where: { id } });
    if (!existing) {
      return fail("记录不存在", 40400, 404);
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = buildVaultWriteData(
      {
        title: parsed.data.title ?? existing.title,
        type: parsed.data.type ?? existing.type,
        account: parsed.data.account !== undefined ? parsed.data.account : existing.account,
        secret: parsed.data.secret,
        url: parsed.data.url !== undefined ? parsed.data.url : existing.url,
        content: parsed.data.content,
        remark: parsed.data.remark !== undefined ? parsed.data.remark : existing.remark,
        pinned: parsed.data.pinned ?? existing.pinned,
      },
      existing
    );

    const row = await prisma.vaultEntry.update({ where: { id }, data });
    await auditAdminAction(req, session.user.id, "vault.update", {
      targetType: "vault_entry",
      targetId: id,
      detail: row.title,
    });
    return ok(toVaultListItem(row));
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Vault Update Error]", error);
    return fail("更新失败", 50000, 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await requireAdmin();
    const existing = await prisma.vaultEntry.findUnique({
      where: { id },
      select: { title: true },
    });
    await prisma.vaultEntry.delete({ where: { id } });
    await auditAdminAction(req, session.user.id, "vault.delete", {
      targetType: "vault_entry",
      targetId: id,
      detail: existing?.title,
    });
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Vault Delete Error]", error);
    return fail("删除失败", 50000, 500);
  }
}