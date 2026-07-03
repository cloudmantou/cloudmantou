import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/site-settings";

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  username: z
    .string()
    .min(2, "用户名至少 2 个字符")
    .max(20, "用户名最多 20 个字符")
    .regex(/^[a-zA-Z0-9_一-鿿]+$/, "用户名只能包含字母、数字、下划线或中文"),
  password: z.string().min(6, "密码至少 6 个字符").max(100, "密码过长"),
  nickname: z.string().max(30, "昵称过长").optional(),
});

export async function POST(req: Request) {
  try {
    // 速率限制：每 IP 每小时最多 5 次注册
    const limited = checkRateLimit(req, RATE_LIMITS.REGISTER);
    if (limited) return limited;

    const settings = await getSiteSettings();
    if (!settings.openRegistration) {
      return fail("当前已关闭新用户注册", 40300, 403);
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return fail(firstError.message, 40000, 400);
    }

    const { email, username, password, nickname } = parsed.data;

    // 检查邮箱是否已注册
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return fail("该邮箱已被注册", 40900, 409);
    }

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return fail("该用户名已被使用", 40900, 409);
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        nickname: nickname || username,
        role: "USER",
      },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        role: true,
        createdAt: true,
      },
    });

    return ok(user, undefined, 201);
  } catch (error) {
    console.error("[Register Error]", error);
    return fail("注册失败，请稍后重试", 50000, 500);
  }
}
