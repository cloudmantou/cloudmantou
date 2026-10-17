import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, requireAdmin, requireAdminAndStrictAudit } from "@/lib/guards";
import { fail } from "@/lib/api-response";
import { feedbackJson, privateOk } from "@/lib/feedback-request";
import { rateLimit } from "@/lib/rate-limit";
import { protectCommerceLicenseMutation } from "@/lib/legacy-license-commerce";
import { licenseMutationSchema, licensePageParams, listLicenses, mutateLicense, type LicenseMutation } from "@/lib/app-licenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof ApiError) return fail(error.message, error.code, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError) return fail("输入格式不正确，请检查后重试", 42200, 422);
  // Database errors may contain card secrets or credentials; never echo them.
  return fail("应用授权操作失败，请稍后重试", 50000, 500);
}

// Row ids and counts only: card secrets and device UDIDs never enter the audit log.
function auditDetail(input: LicenseMutation) {
  if ("count" in input) return `count=${input.count}`;
  if ("cards" in input) return `count=${input.cards.length}`;
  if ("ids" in input) return `count=${input.ids.length} ids=${input.ids.join(",")}`;
  if ("days" in input) return `days=${input.days}`;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    return privateOk(await listLicenses(licensePageParams(req.nextUrl.searchParams)));
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const input = licenseMutationSchema.parse(await feedbackJson(req));
    if (!rateLimit(`app-licenses:${session.user.id}`, 30, 60000).success) throw new ApiError("操作频繁，请稍后重试", 42900, 429);
    await requireAdminAndStrictAudit(req, `app-licenses.${input.action}.attempt`, {
      targetType: "app_license",
      targetId: "id" in input ? String(input.id) : undefined,
      detail: auditDetail(input),
    });
    await protectCommerceLicenseMutation(input);
    return privateOk(await mutateLicense(input));
  } catch (error) { return errorResponse(error); }
}
