import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { expireStalePendingOrders } from "@/lib/order-lifecycle";
import { retryPendingCardDeliveries } from "@/lib/card-delivery";
import { expireLicenseBindings, type BindingExpiryResult } from "@/lib/app-licenses";
import { recordAdminAudit } from "@/lib/admin-audit-log";

export const dynamic = "force-dynamic";

function readCronSecret(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice(7).trim() || null;
  }
  return null;
}

// The legacy license database is optional and separate from the blog database;
// its failures are reported in the payload instead of failing order maintenance.
async function expireBindings(): Promise<BindingExpiryResult | { skipped: string } | { error: string }> {
  if (!process.env.LEGACY_CARD_DATABASE_URL) return { skipped: "LEGACY_CARD_DATABASE_URL 未配置" };
  try {
    const result = await expireLicenseBindings();
    if (result.removed) {
      console.info("[Cron License Bindings] expired", result);
      await recordAdminAudit({
        actorId: "system:cron",
        action: "app-licenses.binding.expire",
        targetType: "app_license",
        detail: `removed=${result.removed} ttlDays=${result.ttlDays} batches=${result.batches} more=${result.more}`,
      });
    }
    return result;
  } catch (error) {
    console.error("[Cron License Bindings Error]", error);
    return { error: "设备绑定到期解除失败" };
  }
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
    const cardDeliveries = await retryPendingCardDeliveries();
    const licenseBindings = await expireBindings();
    return ok({ expired, cardDeliveries, licenseBindings });
  } catch (error) {
    console.error("[Cron Expire Orders Error]", error);
    return fail("清理过期订单失败", 50000, 500);
  }
}
