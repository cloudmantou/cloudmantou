"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

function PaymentResultInner() {
  const searchParams = useSearchParams();
  const orderNo = searchParams.get("orderNo") || "";
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!orderNo) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    const started = Date.now();

    const check = async () => {
      try {
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
          return;
        }
        if (Date.now() - started < 60_000) {
          window.setTimeout(check, 2000);
          setStatus("pending");
        } else {
          setStatus("pending");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [orderNo]);

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
            <Link href="/" className="payment-result-link">返回首页</Link>
          </>
        ) : null}

        {status === "pending" ? (
          <>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--orange)" }} />
            <h1>支付处理中</h1>
            <p>若已完成支付，请稍候或返回首页查看会员状态。</p>
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