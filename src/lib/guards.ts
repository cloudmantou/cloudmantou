import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { auditAdminAction } from "@/lib/admin-audit-log";
import { isVaultTotpConfigured } from "@/lib/vault-totp";
import { verifyVaultUnlockToken, VAULT_UNLOCK_COOKIE } from "@/lib/vault-session";

export class ApiError extends Error {
  code: number;
  status: number;

  constructor(message: string, code: number, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * 后台 API 权限守卫
 * 在每个 /api/admin/* 路由内部显式调用，不依赖 middleware 单层防护
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ApiError("请先登录", 40100, 401);
  }

  if (session.user.role !== "ADMIN") {
    throw new ApiError("无权限，需要管理员身份", 40300, 403);
  }

  return session;
}

/**
 * 登录用户守卫
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ApiError("请先登录", 40100, 401);
  }

  return session;
}

/** Vault 二次验证：配置 TOTP 后需有效解锁 cookie */
export async function requireVaultUnlock(_req?: NextRequest) {
  const session = await requireAdmin();
  if (!isVaultTotpConfigured()) {
    return session;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(VAULT_UNLOCK_COOKIE)?.value;
  if (!verifyVaultUnlockToken(token, session.user.id)) {
    throw new ApiError("请先完成 Vault 二次验证", 40301, 403);
  }

  return session;
}

export async function requireAdminAndAudit(
  req: NextRequest,
  action: string,
  options?: {
    targetType?: string;
    targetId?: string;
    detail?: string;
  }
) {
  const session = await requireAdmin();
  await auditAdminAction(req, session.user.id, action, options);
  return session;
}
