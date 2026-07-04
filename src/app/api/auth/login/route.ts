import { NextRequest } from "next/server";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { fail } from "@/lib/api-response";
import { checkLoginRateLimitServer } from "@/lib/login-rate-limit-server";
import { verifyCredentials } from "@/lib/credentials-auth";

const loginSchema = z.object({
  email: z.string().min(1, "请输入用户名或邮箱"),
  password: z.string().min(1, "请输入密码"),
  callbackUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 40000, 400);
    }

    const { email, password, callbackUrl } = parsed.data;
    const rl = await checkLoginRateLimitServer(req, email);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return new Response(
        JSON.stringify({
          code: 42900,
          message: `登录尝试过于频繁，请 ${retryAfter} 秒后重试`,
          data: null,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
          },
        }
      );
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      return fail("用户名或密码错误", 40100, 401);
    }

    try {
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
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