import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { requireAdmin, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { CATALOG_KEY, catalogSchema } from "@/lib/assistant-catalog";
import { readLoginCatalog } from "@/lib/assistant-catalog-store";
import { hasJsonContentType, isAllowedMutationOrigin } from "@/lib/csrf-origin";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try { await requireAdmin(); return Response.json({ data: (await readLoginCatalog()).catalog }, { headers }); }
  catch (e) { return Response.json({ message: e instanceof ApiError ? e.message : "读取失败" }, { status: e instanceof ApiError ? e.status : 503, headers }); }
}
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!hasJsonContentType(req) || !isAllowedMutationOrigin(req)) return Response.json({ message: "请求来源无效" }, { status: 403, headers });
    const text = await req.text();
    if (text.length > 64000) return Response.json({ message: "配置过大" }, { status: 413, headers });
    let input: unknown; try { input = JSON.parse(text); } catch { return Response.json({ message: "JSON 无效" }, { status: 400, headers }); }
    const parsed = catalogSchema.safeParse(input);
    if (!parsed.success) return Response.json({ message: parsed.error.issues[0].message }, { status: 422, headers });
    const previous = await readLoginCatalog();
    if (previous.catalog.revision !== parsed.data.revision) return Response.json({ message: "列表已被其他管理员修改，请重新加载" }, { status: 409, headers });
    const catalog = { ...parsed.data, revision: randomUUID() };
    await prisma.$transaction(async tx => {
      if (previous.raw === null) {
        await tx.siteSetting.create({ data: { key: CATALOG_KEY, type: "json", value: JSON.stringify(catalog) } });
      } else {
        const update = await tx.siteSetting.updateMany({ where: { key: CATALOG_KEY, value: previous.raw }, data: { value: JSON.stringify(catalog) } });
        if (update.count !== 1) throw new ApiError("列表已变更，请重新加载", 40900, 409);
      }
      await tx.adminAuditLog.create({ data: { actorId: session.user.id, action: "assistant.servers.publish", targetType: "login-catalog", targetId: catalog.revision, detail: `服务器数 ${catalog.servers.length}，启用 ${catalog.servers.filter(s => s.enabled).length}` } });
    });
    return Response.json({ data: catalog }, { headers });
  } catch (e) {
    const conflict = e && typeof e === "object" && "code" in e && e.code === "P2002";
    return Response.json({ message: e instanceof ApiError ? e.message : conflict ? "列表已变更，请重新加载" : "保存失败，配置未发布" }, { status: e instanceof ApiError ? e.status : conflict ? 409 : 503, headers });
  }
}
