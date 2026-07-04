import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { rateLimit, RATE_LIMITS } from "./rate-limit";

/** 固定 bcrypt 哈希，用于用户不存在时占位比对，缓解时序探测 */
const DUMMY_PASSWORD_HASH =
  "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.i8Hy";

export const {
  handlers,    // GET/POST handlers for /api/auth/*
  auth,        // 服务端获取 session
  signIn,
  signOut,
} = NextAuth({
  // 不使用 PrismaAdapter — Credentials provider 用 JWT 策略，adapter 会冲突
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const identifier = (credentials.email as string).trim();
        const password = credentials.password as string;

        // 登录限流仅用内存实现，避免 auth/middleware 打包 ioredis（node: 协议导致 Webpack 构建失败）
        const rlResult = rateLimit(
          `login:${identifier.toLowerCase()}`,
          RATE_LIMITS.LOGIN.limit,
          RATE_LIMITS.LOGIN.windowMs
        );
        if (!rlResult.success) {
          throw new Error("登录尝试过于频繁，请稍后再试");
        }

        const user = await prisma.user.findFirst({
          where: identifier.includes("@")
            ? { email: identifier }
            : { username: identifier },
        });

        if (!user) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.nickname || user.username,
          role: user.role,
          nickname: user.nickname,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.nickname = user.nickname ?? null;
        token.username = user.username ?? null;
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, nickname: true, username: true },
        });

        if (!dbUser) {
          token.sessionInvalid = true;
          return token;
        }

        token.role = dbUser.role;
        token.nickname = dbUser.nickname;
        token.username = dbUser.username;
      }

      return token;
    },
    session({ session, token }) {
      if (token.sessionInvalid) {
        return { ...session, expires: new Date(0).toISOString() };
      }

      if (session.user) {
        // NextAuth v5 beta 的 JWT 索引签名 [key: string]: unknown 会导致
        // 模块扩展中的具体类型被遮蔽，此处使用精确类型断言（非 as any）
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.nickname = (token.nickname as string | null | undefined) ?? null;
        session.user.username = (token.username as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});