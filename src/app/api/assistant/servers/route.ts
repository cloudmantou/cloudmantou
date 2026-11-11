import { publicCatalog } from "@/lib/assistant-catalog";
import { readLoginCatalog } from "@/lib/assistant-catalog-store";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { catalog } = await readLoginCatalog();
    return Response.json(publicCatalog(catalog, new URL(req.url).searchParams.get("format") === "sidestore"), { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ message: "服务器列表暂不可用" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
