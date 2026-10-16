import { NextRequest } from "next/server";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { fail } from "@/lib/api-response";
import { hasJsonContentType, isAllowedMutationOrigin } from "@/lib/csrf-origin";

const loginSchema = z.object({
  email: z.string().min(1, "请输入用户名或邮箱"),
  password: z.string().min(1, "请输入密码"),
  callbackUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // 自定义登录入口不经过 NextAuth 的 CSRF token，需自行阻止跨站登录（login CSRF）。
  if (!isAllowedMutationOrigin(req)) {
    return fail("跨站请求被拒绝", 40300, 403);
  }
  if (!hasJsonContentType(req)) {
    return fail("请求格式不正确", 41500, 415);
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 40000, 400);
    }

    const { email, password, callbackUrl } = parsed.data;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          return fail("用户名或密码错误", 40100, 401);
        }
        return fail("登录失败，请稍后重试", 50000, 500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("频繁")) {
        return fail(message, 42900, 429);
      }
      console.error("[Auth Login signIn Error]", error);
      return fail("登录失败，请稍后重试", 50000, 500);
    }

    return Response.json({
      code: 0,
      message: "ok",
      data: { callbackUrl: callbackUrl || "/" },
    });
  } catch (error) {
    console.error("[Auth Login API Error]", error);
    return fail("登录失败，请稍后重试", 50000, 500);
  }
}