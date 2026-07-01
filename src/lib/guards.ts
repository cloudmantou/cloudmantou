import { auth } from "@/lib/auth";

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

  if ((session.user as any).role !== "ADMIN") {
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
