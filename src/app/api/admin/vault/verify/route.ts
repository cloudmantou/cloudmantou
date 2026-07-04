import { NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { requireAdmin, ApiError } from "@/lib/guards";
import { ok, fail } from "@/lib/api-response";
import { isVaultTotpConfigured, verifyVaultTotp } from "@/lib/vault-totp";
import {
  createVaultUnlockToken,
  vaultUnlockCookieOptions,
  VAULT_UNLOCK_COOKIE,
  VAULT_UNLOCK_TTL_MS,
} from "@/lib/vault-session";
import { auditAdminAction } from "@/lib/admin-audit-log";

const verifySchema = z.object({
  code: z.string().min(6).max(8),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();

    if (!isVaultTotpConfigured()) {
      return fail("未配置 VAULT_TOTP_SECRET，无法启用 Vault 二次验证", 50300, 503);
    }

    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    if (!verifyVaultTotp(parsed.data.code)) {
      await auditAdminAction(req, session.user.id, "vault.verify_failed");
      return fail("验证码错误或已过期", 40100, 401);
    }

    const now = Date.now();
    const token = createVaultUnlockToken(session.user.id, now);
    const cookieStore = await cookies();
    cookieStore.set(
      VAULT_UNLOCK_COOKIE,
      token,
      vaultUnlockCookieOptions(now + VAULT_UNLOCK_TTL_MS)
    );

    await auditAdminAction(req, session.user.id, "vault.verify_success");
    return ok({ unlocked: true, expiresIn: VAULT_UNLOCK_TTL_MS });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Vault Verify Error]", error);
    return fail("验证失败", 50000, 500);
  }
}

export async function GET() {
  try {
    await requireAdmin();
    return ok({
      totpConfigured: isVaultTotpConfigured(),
      ttlMs: VAULT_UNLOCK_TTL_MS,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    return fail("获取 Vault 验证状态失败", 50000, 500);
  }
}