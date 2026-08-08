import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIP } from "@/lib/rate-limit";

const MAX_DETAIL = 4000;

export type AdminAuditInput = {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  ip?: string | null;
};

function adminAuditData(input: AdminAuditInput) {
  return {
    actorId: input.actorId,
    action: input.action.slice(0, 100),
    targetType: input.targetType?.slice(0, 50) ?? null,
    targetId: input.targetId?.slice(0, 100) ?? null,
    detail: input.detail ? input.detail.slice(0, MAX_DETAIL) : null,
    ip: input.ip?.slice(0, 64) ?? null,
  };
}

export async function recordAdminAuditStrict(input: AdminAuditInput): Promise<void> {
  await prisma.adminAuditLog.create({ data: adminAuditData(input) });
}

export async function recordAdminAudit(input: AdminAuditInput): Promise<void> {
  try {
    await recordAdminAuditStrict(input);
  } catch (error) {
    console.error("[AdminAuditLog] write failed:", error);
  }
}

export async function auditAdminActionStrict(
  req: NextRequest,
  actorId: string,
  action: string,
  options?: Omit<AdminAuditInput, "actorId" | "action" | "ip">
): Promise<void> {
  await recordAdminAuditStrict({
    actorId,
    action,
    ip: getClientIP(req),
    ...options,
  });
}

export async function auditAdminAction(
  req: NextRequest,
  actorId: string,
  action: string,
  options?: Omit<AdminAuditInput, "actorId" | "action" | "ip">
): Promise<void> {
  await recordAdminAudit({
    actorId,
    action,
    ip: getClientIP(req),
    ...options,
  });
}
