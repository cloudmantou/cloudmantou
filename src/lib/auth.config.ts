import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/** Edge 安全：middleware 仅依赖此配置，不引入 Prisma / Redis */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.nickname = user.nickname ?? null;
        token.username = user.username ?? null;
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
} satisfies NextAuthConfig;