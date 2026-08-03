"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CreditCard, Loader2 } from "lucide-react";
import { PaymentCheckout, type CheckoutOrder } from "@/components/payment/PaymentCheckout";
import type { PostAccessReason } from "@/lib/post-access";
import { localizeOfficialPath, type OfficialLocale } from "@/i18n/official";
import { readApiEnvelope } from "@/lib/client-api-response";

export function getPaidPostLoginHref(slug: string, locale: OfficialLocale): string {
  const callbackUrl = localizeOfficialPath(`/post/${slug}`, locale);
  return `${localizeOfficialPath("/login", locale)}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function shouldOfferPaidPostPurchase(
  status: string,
  accessReason: PostAccessReason
): boolean {
  return status === "PAID_ONLY" && accessReason !== "vip_active" && accessReason !== "paid_post_entitled";
}

export async function createPaidPostOrder(
  productId: string,
  locale: OfficialLocale,
  request: typeof fetch = fetch
): Promise<CheckoutOrder> {
  const fallbackMessage = locale === "en" ? "Unable to create the order" : "创建订单失败";
  const response = await request("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productType: "PAID_POST", productId }),
  });
  const body = await readApiEnvelope(response, fallbackMessage, locale !== "en");
  const order = body.data;
  if (
    !order
    || typeof order !== "object"
    || Array.isArray(order)
    || typeof (order as Record<string, unknown>).id !== "string"
    || typeof (order as Record<string, unknown>).orderNo !== "string"
    || typeof (order as Record<string, unknown>).title !== "string"
    || typeof (order as Record<string, unknown>).amount !== "number"
    || !Number.isFinite((order as Record<string, unknown>).amount)
  ) {
    throw new Error(fallbackMessage);
  }
  return order as CheckoutOrder;
}

type PostPurchaseButtonProps = {
  postId: string;
  slug: string;
  status: string;
  accessReason: PostAccessReason;
  price: number | null;
  locale: OfficialLocale;
};

export function PostPurchaseButton({
  postId,
  slug,
  status,
  accessReason,
  price,
  locale,
}: PostPurchaseButtonProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  if (!shouldOfferPaidPostPurchase(status, accessReason)) return null;

  const handlePurchase = async () => {
    if (sessionStatus === "loading" || creating) return;
    if (!session?.user) {
      router.push(getPaidPostLoginHref(slug, locale));
      return;
    }

    setCreating(true);
    setError("");
    try {
      const checkoutOrder = await createPaidPostOrder(postId, locale);
      setOrder(checkoutOrder);
      setCheckoutOpen(true);
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : locale === "en"
            ? "Unable to create the order"
            : "创建订单失败"
      );
    } finally {
      setCreating(false);
    }
  };

  const returnPath = localizeOfficialPath(`/post/${slug}`, locale);

  return (
    <div className="paid-post-purchase" aria-label={locale === "en" ? "Purchase article access" : "购买文章阅读权限"}>
      <button type="button" className="editorial-button editorial-button-blue" onClick={handlePurchase} disabled={creating || sessionStatus === "loading"}>
        {creating ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <CreditCard size={17} aria-hidden="true" />}
        {creating
          ? (locale === "en" ? "Creating order…" : "正在创建订单…")
          : price !== null
            ? (locale === "en" ? `Purchase access · ¥${price.toFixed(2)}` : `购买阅读权限 · ¥${price.toFixed(2)}`)
            : (locale === "en" ? "Purchase access" : "购买阅读权限")}
      </button>
      {error ? <p className="paid-post-purchase-error" role="alert">{error}</p> : null}
      <PaymentCheckout
        order={order}
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onPaid={() => router.refresh()}
        returnPath={returnPath}
      />
    </div>
  );
}
