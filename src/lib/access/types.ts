/**
 * 统一权限决策模型
 *
 * 优先级（高 → 低）：
 * 1. PUBLIC      — 文章 status = PUBLISHED
 * 2. VIP         — Entitlement.type = VIP（时间型）
 * 3. POST_ENTITLEMENT — Entitlement.type = PAID_POST 且 postId 已绑定
 * 4. ARTICLE_CREDIT   — Entitlement.type = PAID_POST 且 postId = null（额度池，需显式 unlock）
 * 5. NONE
 *
 * 文章券绝不于 GET 路径自动消耗；仅 POST /api/posts/[slug]/unlock 可写入。
 */

export type AccessGrantReason =
  | "PUBLIC"
  | "VIP"
  | "POST_ENTITLEMENT"
  | "ARTICLE_CREDIT_AVAILABLE"
  | "NONE";

/** @deprecated 兼容旧 API 字段，与 AccessGrantReason 映射 */
export type PostAccessReason =
  | "published"
  | "vip_active"
  | "paid_post_entitled"
  | "article_credit"
  | "article_credit_available"
  | "no_access";

export type AccessDecision = {
  allowed: boolean;
  reason: AccessGrantReason;
  /** 是否需要用户主动调用 unlock 接口 */
  requiresUnlock: boolean;
  content: string | null;
  articleCreditsAvailable?: number;
};

export type PostAccessResult = {
  hasAccess: boolean;
  reason: PostAccessReason;
  content: string | null;
  articleCreditsAvailable?: number;
};

export function toLegacyReason(reason: AccessGrantReason): PostAccessReason {
  switch (reason) {
    case "PUBLIC":
      return "published";
    case "VIP":
      return "vip_active";
    case "POST_ENTITLEMENT":
      return "paid_post_entitled";
    case "ARTICLE_CREDIT_AVAILABLE":
      return "article_credit_available";
    default:
      return "no_access";
  }
}

export function toLegacyResult(decision: AccessDecision): PostAccessResult {
  return {
    hasAccess: decision.allowed,
    reason: toLegacyReason(decision.reason),
    content: decision.content,
    articleCreditsAvailable: decision.articleCreditsAvailable,
  };
}