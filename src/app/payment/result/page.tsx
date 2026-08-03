"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { interpolateMessage, localizeOfficialPath } from "@/i18n/official";
import { localizeEditorialOrderTitle } from "@/lib/editorial-commerce";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { resolvePaymentResultState } from "@/lib/payment-state";

function collectAlipayReturnParams(searchParams: URLSearchParams) {
  const params: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === "orderNo") continue;
    params[key] = value;
  }
  return params;
}

function PaymentResultInner() {
  const router = useRouter();
  const { locale, messages } = useOfficialI18n();
  const dashboardOrdersUrl = localizeOfficialPath("/dashboard?paid=1#orders", locale);
  const copy = messages.payment.result;
  const searchParams = useSearchParams();
  const orderNo = searchParams.get("orderNo") || "";
  const returnParams = useMemo(
    () => collectAlipayReturnParams(searchParams),
    [searchParams]
  );
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!orderNo) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    const started = Date.now();
    const check = async () => {
      try {
        await fetch("/api/payment/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNo, returnParams }),
        });

        const res = await fetch(`/api/payment/status?orderNo=${encodeURIComponent(orderNo)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        setTitle(
          localizeEditorialOrderTitle(
            {
              title: data.data?.title || "",
              productType: data.data?.productType,
              productId: data.data?.productId,
              product: data.data?.product,
            },
            locale
          )
        );
        setAmount(data.data?.amount ?? null);
        const paymentResultState = resolvePaymentResultState(
          data.data?.status || "UNKNOWN",
          Boolean(data.data?.deliveryPending)
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
        if (Date.now() - started < 180_000) {
          setStatus("pending");
          setHint(
            data.data?.deliveryPending
              ? copy.deliveryPending
              : copy.confirmingProvider
          );
          window.setTimeout(check, 2000);
        } else {
          setStatus("pending");
          setHint(copy.delayed);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [copy.confirmingProvider, copy.delayed, copy.deliveryPending, locale, orderNo, returnParams]);

  useEffect(() => {
    if (status !== "paid") return;
    const timer = window.setTimeout(() => {
      router.replace(dashboardOrdersUrl);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [dashboardOrdersUrl, status, router]);

  return (
    <div className="payment-result-page editorial-payment-result">
      <div className="payment-result-card" role="status" aria-live="polite">
        {status === "loading" ? (
          <>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
            <h1>{copy.confirming}</h1>
            <p>{interpolateMessage(messages.payment.orderNo, { orderNo })}</p>
          </>
        ) : null}

        {status === "paid" ? (
          <>
            <CheckCircle2 size={40} style={{ color: "var(--teal)" }} />
            <h1>{copy.success}</h1>
            <p>{title}</p>
            {amount != null ? <div className="payment-result-amount">¥{amount.toFixed(2)}</div> : null}
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0" }}>
              {copy.redirecting}
            </p>
            <Link href={dashboardOrdersUrl} className="payment-result-link">
              {copy.viewOrders}
            </Link>
          </>
        ) : null}

        {status === "pending" ? (
          <>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--orange)" }} />
            <h1>{copy.processing}</h1>
            <p>{hint || copy.pendingFallback}</p>
            <Link href={localizeOfficialPath("/", locale)} className="payment-result-link">{copy.home}</Link>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <XCircle size={40} style={{ color: "var(--rose)" }} />
            <h1>{copy.queryFailed}</h1>
            <Link href={localizeOfficialPath("/", locale)} className="payment-result-link">{copy.home}</Link>
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
    <Suspense
      fallback={
        <div className="payment-result-page editorial-payment-result">
          <div className="payment-result-card">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        </div>
      }
    >
      <PaymentResultInner />
    </Suspense>
    </EditorialShell>
  );
}
