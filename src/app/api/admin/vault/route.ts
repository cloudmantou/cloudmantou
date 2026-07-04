import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { buildVaultWriteData, toVaultListItem } from "@/lib/vault";
import { auditAdminAction } from "@/lib/admin-audit-log";

const createSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200),
  type: z.enum(["ACCOUNT", "SECRET", "NOTE"]).default("NOTE"),
  account: z.string().max(500).optional().nullable(),
  secret: z.string().max(8_000).optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal("")),
  content: z.string().max(16_384).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
  pinned: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type");
    const q = searchParams.get("q")?.trim();

    const rows = await prisma.vaultEntry.findMany({
      where: {
        ...(type && type !== "all" ? { type: type as "ACCOUNT" | "SECRET" | "NOTE" } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { account: { contains: q } },
                { remark: { contains: q } },
                { url: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });

    return ok(rows.map(toVaultListItem));
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Vault List Error]", error);
    return fail("获取私密笔记失败", 50000, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const data = buildVaultWriteData(parsed.data);
    const row = await prisma.vaultEntry.create({ data });

    await auditAdminAction(req, session.user.id, "vault.create", {
      targetType: "vault_entry",
      targetId: row.id,
      detail: row.title,
    });

    return ok(toVaultListItem(row));
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Vault Create Error]", error);
    return fail("创建私密笔记失败", 50000, 500);
  }
}