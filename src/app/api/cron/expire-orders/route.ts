import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { expireStalePendingOrders } from "@/lib/order-lifecycle";

export const dynamic = "force-dynamic";

function readCronSecret(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice(7).trim() || null;
  }
  return req.nextUrl.searchParams.get("secret")?.trim() || null;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return fail("CRON_SECRET 未配置", 50300, 503);
  }

  const provided = readCronSecret(req);
  if (!provided || provided !== expected) {
    return fail("未授权", 40100, 401);
  }

  try {
    const expired = await expireStalePendingOrders();
    return ok({ expired });
  } catch (error) {
    console.error("[Cron Expire Orders Error]", error);
    return fail("清理过期订单失败", 50000, 500);
  }
}