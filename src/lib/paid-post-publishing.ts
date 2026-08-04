export type PostPublishStatus = "DRAFT" | "PUBLISHED" | "PAID_ONLY";

export type PaidPostContentInput = {
  content: string;
  price: number;
};

type PaidPostSubmissionInput = {
  mode: "create" | "edit";
  requestedStatus: PostPublishStatus;
  isPaid: boolean;
  paidContent: string;
  paidPrice: string;
};

type PaidPostSubmissionResult =
  | {
      ok: true;
      status: PostPublishStatus;
      paidContent: PaidPostContentInput | null | undefined;
    }
  | { ok: false; error: string };

type PaidPostMutationInput = {
  status: PostPublishStatus;
  paidContent: PaidPostContentInput | null | undefined;
  hasExistingPaidContent?: boolean;
};

export const MAX_PAID_POST_PRICE = 99_999_999.99;
export const MAX_PAID_POST_CONTENT_LENGTH = 500_000;

export function isValidPaidPostPrice(price: number) {
  if (!Number.isFinite(price) || price < 0.01 || price > MAX_PAID_POST_PRICE) {
    return false;
  }

  const cents = price * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-8;
}

export function isPublishedPostStatus(status: PostPublishStatus) {
  return status === "PUBLISHED" || status === "PAID_ONLY";
}

export function preparePaidPostSubmission(
  input: PaidPostSubmissionInput,
): PaidPostSubmissionResult {
  const status =
    input.requestedStatus === "DRAFT"
      ? "DRAFT"
      : input.isPaid
        ? "PAID_ONLY"
        : "PUBLISHED";

  if (!input.isPaid) {
    return {
      ok: true,
      status,
      paidContent: input.mode === "edit" ? null : undefined,
    };
  }

  const content = input.paidContent.trim();
  const priceText = input.paidPrice.trim();
  const hasContent = content.length > 0;
  const hasPrice = priceText.length > 0;

  if (hasContent !== hasPrice) {
    return { ok: false, error: "付费内容和价格需要同时填写" };
  }

  if (!hasContent && !hasPrice) {
    if (status === "PAID_ONLY") {
      return { ok: false, error: "发布付费文章前请填写付费内容和价格" };
    }

    return {
      ok: true,
      status,
      paidContent: input.mode === "edit" ? null : undefined,
    };
  }

  const price = Number(priceText);
  if (!isValidPaidPostPrice(price)) {
    return { ok: false, error: "付费价格必须是大于等于 0.01 的两位小数" };
  }

  return {
    ok: true,
    status,
    paidContent: { content, price },
  };
}

export function validatePaidPostMutation(input: PaidPostMutationInput) {
  if (input.status === "PUBLISHED" && input.paidContent) {
    return "公开文章不能同时保存付费内容";
  }

  const hasPaidContent =
    input.paidContent === undefined
      ? Boolean(input.hasExistingPaidContent)
      : input.paidContent !== null;

  if (input.status === "PAID_ONLY" && !hasPaidContent) {
    return "付费文章必须填写付费内容和价格";
  }

  return null;
}
