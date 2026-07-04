import { headers } from "next/headers";
import { usesScriptNonce } from "@/config/csp";

/** 仅在生产 CSP 启用时返回 nonce；开发模式跳过以避免 hydration 不一致 */
export async function getCspNonce(): Promise<string | undefined> {
  if (!usesScriptNonce()) return undefined;

  const h = await headers();
  const value = h.get("x-nonce")?.trim();
  return value || undefined;
}