import { headers } from "next/headers";

export async function getCspNonce(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-nonce") ?? undefined;
}