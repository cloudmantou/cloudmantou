/**
 * @deprecated 请使用 @/lib/access；此文件保留向后兼容 re-export。
 */
export type {
  PostAccessReason,
  PostAccessResult,
  UnlockPostResult,
} from "@/lib/access";

export {
  countArticleCredits,
  decidePostAccess,
  getPostPrice,
  unlockPostWithArticleCredit,
} from "@/lib/access";

import { decidePostAccess, toLegacyResult } from "@/lib/access";
import type { PostAccessResult } from "@/lib/access";

/** @deprecated 使用 decidePostAccess */
export async function getPostAccess(
  userId: string | null,
  postId: string,
  publicContent: string,
  paidContent: string | null,
  status: string
): Promise<PostAccessResult> {
  const decision = await decidePostAccess({
    userId,
    postId,
    publicContent,
    paidContent,
    status,
  });
  return toLegacyResult(decision);
}