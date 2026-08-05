"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { interpolateMessage, localizeOfficialPath } from "@/i18n/official";
import { localizeEditorialOrderTitle } from "@/lib/editorial-commerce";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { resolvePaymentResultState } from "@/lib/payment-state";
import type { OrderFulfillment } from "@/lib/order-fulfillment";

function collectAlipayReturnParams(searchParams: URLSearchParams) {
  return Object.fromEntries(
    Array.from(searchParams.entries()).filter(([key]) => key !== "orderNo")
  );
}

function PaymentResultInner() {
  const { locale, messages } = useOfficialI18n();
  const paymentCopy = messages.payment;
  const copy = paymentCopy.result;
  const dashboardOrdersUrl = localizeOfficialPath("/dashboard?paid=1#orders", locale);
  const searchParams = useSearchParams();
  const orderNo = searchParams.get("orderNo") || "";
  const returnParams = useMemo(() => collectAlipayReturnParams(searchParams), [searchParams]);
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [fulfillment, setFulfillment] = useState<OrderFulfillment | null>(null);
  const [hint, setHint] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState<"cardNo" | "cardSecret" | null>(null);

  useEffect(() => {
    if (!orderNo) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    const started = Date.now();
    const scheduleRetry = (nextHint: string) => {
      if (cancelled) return;
      if (Date.now() - started < 180_000) {
        setStatus("pending");
        setHint(nextHint);
        timer = window.setTimeout(check, 2000);
      } else {
        setStatus("pending");
        setHint(copy.delayed);
      }
    };
    const check = async () => {
      try {
        await fetch("/api/payment/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNo, returnParams }),
        });

        const response = await fetch(`/api/payment/status?orderNo=${encodeURIComponent(orderNo)}`);
        if (cancelled) return;
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) {
            setStatus("error");
          } else {
            scheduleRetry(copy.confirmingProvider);
          }
          return;
        }
        const payload = await response.json();

        const data = payload.data;
        setTitle(localizeEditorialOrderTitle({
          title: data?.title || "",
          productType: data?.productType,
          productId: data?.productId,
          product: data?.product,
        }, locale));
        setAmount(typeof data?.amount === "number" ? data.amount : null);
        setFulfillment(data?.fulfillment || null);

        const paymentResultState = resolvePaymentResultState(
          data?.status || "UNKNOWN",
          Boolean(data?.deliveryPending)
        );
        if (paymentResultState === "paid") {
          setStatus("paid");
          setHint("");
          return;
        }
        if (paymentResultState === "error") {
          setStatus("error");
          setHint("");
          return;
        }
        scheduleRetry(data?.deliveryPending ? copy.deliveryPending : copy.confirmingProvider);
      } catch {
        scheduleRetry(copy.confirmingProvider);
      }
    };

    void check();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [copy.confirmingProvider, copy.delayed, copy.deliveryPending, locale, orderNo, returnParams]);

  const copyValue = async (kind: "cardNo" | "cardSecret", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setCopyError("");
    } catch {
      setCopyError(paymentCopy.copyFailed);
    }
  };

  const fulfillmentMessage = fulfillment?.kind === "membership"
    ? paymentCopy.membershipDelivered
    : fulfillment?.kind === "article"
      ? paymentCopy.articleDelivered
      : fulfillment?.kind === "card" && !fulfillment.card
        ? paymentCopy.cardDelivering
        : null;

  return (
    <div className="payment-result-page editorial-payment-result">
      <div className="payment-result-card" role="status" aria-live="polite">
        {status === "loading" ? (
          <>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
            <h1>{copy.confirming}</h1>
            <p>{interpolateMessage(paymentCopy.orderNo, { orderNo })}</p>
          </>
        ) : null}

        {status === "paid" ? (
          <>
            <CheckCircle2 size={40} style={{ color: "var(--teal)" }} />
            <h1>{copy.success}</h1>
            <p>{title}</p>
            <p className="payment-result-order">{interpolateMessage(paymentCopy.orderNo, { orderNo })}</p>
            {amount != null ? <div className="payment-result-amount">¥{amount.toFixed(2)}</div> : null}
            {fulfillment?.card ? (
              <div className="payment-result-delivery">
                <div>
                  <span>{paymentCopy.cardNumber}</span>
                  <code>{fulfillment.card.cardNo}</code>
                  <button type="button" onClick={() => void copyValue("cardNo", fulfillment.card!.cardNo)}>
                    <Copy size={14} />{copied === "cardNo" ? paymentCopy.copied : paymentCopy.copy}
                  </button>
                </div>
                <div>
                  <span>{paymentCopy.cardSecret}</span>
                  <code>{fulfillment.card.cardSecret}</code>
                  <button type="button" onClick={() => void copyValue("cardSecret", fulfillment.card!.cardSecret)}>
                    <Copy size={14} />{copied === "cardSecret" ? paymentCopy.copied : paymentCopy.copy}
                  </button>
                </div>
              </div>
            ) : fulfillmentMessage ? <p>{fulfillmentMessage}</p> : null}
            <p className="payment-result-saved">{copy.redirecting}</p>
            {copyError ? <p className="payment-result-copy-error" role="alert">{copyError}</p> : null}
            <Link href={dashboardOrdersUrl} className="payment-result-link">{copy.viewOrders}</Link>
          </>
        ) : null}

        {status === "pending" ? (
          <>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--orange)" }} />
            <h1>{copy.processing}</h1>
            <p>{hint || copy.pendingFallback}</p>
            <Link href={dashboardOrdersUrl} className="payment-result-link">{copy.viewOrders}</Link>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <XCircle size={40} style={{ color: "var(--rose)" }} />
            <h1>{copy.queryFailed}</h1>
            <Link href={dashboardOrdersUrl} className="payment-result-link">{copy.viewOrders}</Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  const { locale } = useOfficialI18n();
  return (
    <EditorialShell locale={locale}>
      <Suspense fallback={<div className="payment-result-page editorial-payment-result"><div className="payment-result-card"><Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} /></div></div>}>
        <PaymentResultInner />
      </Suspense>
    </EditorialShell>
  );
}
