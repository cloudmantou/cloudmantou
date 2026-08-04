export function isPrismaUniqueConstraintError(error: unknown, field: string) {
  if (!error || typeof error !== "object") return false;

  const record = error as { code?: unknown; meta?: { target?: unknown } };
  if (record.code !== "P2002") return false;

  const target = record.meta?.target;
  if (Array.isArray(target)) {
    return target.some((item) => item === field);
  }

  return typeof target === "string" && target.includes(field);
}
