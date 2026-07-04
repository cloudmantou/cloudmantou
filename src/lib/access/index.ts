export type {
  AccessDecision,
  AccessGrantReason,
  PostAccessReason,
  PostAccessResult,
} from "@/lib/access/types";
export { toLegacyReason, toLegacyResult } from "@/lib/access/types";
export {
  countArticleCredits,
  hasActiveVip,
  hasPostEntitlement,
} from "@/lib/access/entitlements";
export {
  decidePostAccess,
  getPostPrice,
  unlockPostWithArticleCredit,
  type UnlockPostResult,
} from "@/lib/access/post-access-service";