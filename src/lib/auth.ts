import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@prisma/client";
import { getClientIP } from "./rate-limit";
import { checkLoginRateLimit } from "./login-rate-limit";
import { verifyCredentials } from "./credentials-auth";

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
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const identifier = (credentials.email as string).trim();
        const password = credentials.password as string;

        // middleware 打包路径无法使用 Redis；内存双维度限流作为兜底
        const rlResult = checkLoginRateLimit(getClientIP(request), identifier);
        if (!rlResult.success) {
          throw new Error("登录尝试过于频繁，请稍后再试");
        }

        return verifyCredentials(identifier, password);
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
        const { prisma } = await import("@/lib/prisma");
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
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.nickname = (token.nickname as string | null | undefined) ?? null;
        session.user.username = (token.username as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});