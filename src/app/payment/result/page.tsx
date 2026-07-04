"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const DASHBOARD_ORDERS_URL = "/dashboard?paid=1#orders";

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
        setTitle(data.data?.title || "");
        setAmount(data.data?.amount ?? null);
        if (data.data?.status === "PAID") {
          setStatus("paid");
          setHint("");
          return;
        }
        if (Date.now() - started < 180_000) {
          setStatus("pending");
          setHint("正在向支付宝确认支付结果，本地测试无公网回调时会自动查单…");
          window.setTimeout(check, 2000);
        } else {
          setStatus("pending");
          setHint("若支付宝已扣款但状态未更新，请稍后刷新或联系管理员手动查单。");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [orderNo, returnParams]);

  useEffect(() => {
    if (status !== "paid") return;
    const timer = window.setTimeout(() => {
      router.replace(DASHBOARD_ORDERS_URL);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [status, router]);

  return (
    <div className="payment-result-page">
      <div className="payment-result-card">
        {status === "loading" ? (
          <>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
            <h1>正在确认支付结果</h1>
            <p>订单号 {orderNo}</p>
          </>
        ) : null}

        {status === "paid" ? (
          <>
            <CheckCircle2 size={40} style={{ color: "var(--teal)" }} />
            <h1>支付成功</h1>
            <p>{title}</p>
            {amount != null ? <div className="payment-result-amount">¥{amount.toFixed(2)}</div> : null}
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0" }}>
              正在跳转到会员中心订单页…
            </p>
            <Link href={DASHBOARD_ORDERS_URL} className="payment-result-link">
              查看我的订单
            </Link>
          </>
        ) : null}

        {status === "pending" ? (
          <>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--orange)" }} />
            <h1>支付处理中</h1>
            <p>{hint || "若已完成支付，请稍候或返回首页查看会员状态。"}</p>
            <Link href="/" className="payment-result-link">返回首页</Link>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <XCircle size={40} style={{ color: "var(--rose)" }} />
            <h1>无法查询订单</h1>
            <Link href="/" className="payment-result-link">返回首页</Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="payment-result-page">
          <div className="payment-result-card">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        </div>
      }
    >
      <PaymentResultInner />
    </Suspense>
  );
}