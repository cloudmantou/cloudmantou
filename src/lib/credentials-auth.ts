import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 固定 bcrypt 哈希，用于用户不存在时占位比对，缓解时序探测 */
export const DUMMY_PASSWORD_HASH =
  "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.i8Hy";

export type VerifiedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  nickname: string | null;
  username: string;
};

export async function verifyCredentials(
  identifier: string,
  password: string
): Promise<VerifiedUser | null> {
  const trimmed = identifier.trim();
  if (!trimmed || !password) return null;

  const user = await prisma.user.findFirst({
    where: trimmed.includes("@")
      ? { email: trimmed.toLowerCase() }
      : { username: trimmed },
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
}