import { NextRequest } from "next/server";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { fail } from "@/lib/api-response";

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