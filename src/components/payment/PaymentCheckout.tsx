"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Smartphone, Monitor, X } from "lucide-react";
import clsx from "clsx";
import QRCode from "qrcode";

export type CheckoutOrder = {
  id: string;
  orderNo: string;
  title: string;
  amount: number;
};

type PaymentScene = "pc" | "h5" | "wechat_inapp";

type Props = {
  order: CheckoutOrder | null;
  open: boolean;
  onClose: () => void;
  onPaid?: () => void;
};

function detectScene(): PaymentScene {
  if (typeof navigator === "undefined") return "pc";
  const ua = navigator.userAgent.toLowerCase();
  if (/micromessenger/.test(ua)) return "wechat_inapp";
  if (/mobile|android|iphone|ipod|ipad/i.test(ua)) return "h5";
  return "pc";
}

function sceneText(scene: PaymentScene) {
  if (scene === "pc") return "电脑网站支付 / 微信扫码";
  if (scene === "wechat_inapp") return "微信内 · 仅支持支付宝";
  return "手机 H5 支付";
}

const DASHBOARD_ORDERS_URL = "/dashboard?paid=1#orders";

export function PaymentCheckout({ order, open, onClose, onPaid }: Props) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [scene, setScene] = useState<PaymentScene>("pc");
  const [loading, setLoading] = useState<"ALIPAY" | "WECHAT" | null>(null);
  const [error, setError] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const onPaidRef = useRef(onPaid);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const finishPaid = useCallback(() => {
    onPaidRef.current?.();
    onCloseRef.current();
    router.push(DASHBOARD_ORDERS_URL);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    if (sessionStatus === "unauthenticated") {
      onClose();
      router.push(`/login?callbackUrl=${encodeURIComponent(DASHBOARD_ORDERS_URL)}`);
      return;
    }
    if (sessionStatus === "loading") return;
    setScene(detectScene());
    setError("");
    setQrUrl(null);
    setQrImage(null);
    setPolling(false);
    setLoading(null);
  }, [open, order?.id, sessionStatus, onClose, router]);

  useEffect(() => {
    if (!qrUrl) {
      setQrImage(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrUrl, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrImage(url);
      })
      .catch(() => {
        if (!cancelled) setQrImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  const pollStatus = useCallback(async (orderNo: string) => {
    setPolling(true);
    const started = Date.now();
    const tick = async () => {
      try {
        await fetch("/api/payment/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNo }),
        });
        const res = await fetch(`/api/payment/status?orderNo=${encodeURIComponent(orderNo)}`);
        const data = await res.json();
        if (data.data?.status === "PAID") {
          setPolling(false);
          finishPaid();
          return;
        }
      } catch {
        // ignore
      }
      if (Date.now() - started < 5 * 60 * 1000) {
        window.setTimeout(tick, 2500);
      } else {
        setPolling(false);
      }
    };
    tick();
  }, [finishPaid]);

  const launchPay = async (channel: "ALIPAY" | "WECHAT") => {
    if (!order) return;
    setLoading(channel);
    setError("");
    setQrUrl(null);

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, channel, scene }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "发起支付失败");

      const payload = data.data;

      if (payload.type === "test") {
        const testRes = await fetch("/api/payment/test-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });
        const testData = await testRes.json();
        if (!testRes.ok) throw new Error(testData.message || "模拟支付失败");
        finishPaid();
        return;
      }

      if (payload.type === "navigate" && payload.url) {
        window.location.href = payload.url;
        return;
      }

      // 兼容旧版 form 响应：走服务端跳转页，避免 about:blank 继承站点 CSP
      if (payload.type === "form" && payload.html) {
        const fallbackUrl = `/payment/alipay-launch?orderId=${encodeURIComponent(order.id)}&scene=${encodeURIComponent(scene)}`;
        window.location.href = fallbackUrl;
        return;
      }

      if (payload.type === "redirect" && payload.url) {
        window.location.href = payload.url;
        return;
      }

      if (payload.type === "qrcode" && payload.codeUrl) {
        setQrUrl(payload.codeUrl);
        pollStatus(order.orderNo);
        return;
      }

      throw new Error("未知支付响应");
    } catch (e) {
      setError(e instanceof Error ? e.message : "支付失败");
    } finally {
      setLoading(null);
    }
  };

  const wechatDisabled = scene === "wechat_inapp";

  if (!open || !order || sessionStatus !== "authenticated" || !session) return null;

  return (
    <div className="payment-checkout-overlay" role="dialog" aria-modal="true" aria-label="收银台">
      <button type="button" className="payment-checkout-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="payment-checkout-modal">
        <div className="payment-checkout-header">
          <div>
            <div className="payment-checkout-title">收银台</div>
            <div className="payment-checkout-sub">{sceneText(scene)}</div>
          </div>
          <button type="button" className="payment-checkout-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="payment-checkout-order">
          <div className="payment-checkout-product">{order.title}</div>
          <div className="payment-checkout-amount">
            <span>¥</span>
            {order.amount.toFixed(2)}
          </div>
          <div className="payment-checkout-meta">订单号 {order.orderNo}</div>
        </div>

        <div className="payment-checkout-scene">
          <button
            type="button"
            className={clsx("payment-scene-btn", scene === "pc" && "active")}
            onClick={() => setScene("pc")}
          >
            <Monitor size={14} />
            电脑
          </button>
          <button
            type="button"
            className={clsx("payment-scene-btn", scene === "h5" && "active")}
            onClick={() => setScene("h5")}
          >
            <Smartphone size={14} />
            手机 H5
          </button>
          <button
            type="button"
            className={clsx("payment-scene-btn", scene === "wechat_inapp" && "active")}
            onClick={() => setScene("wechat_inapp")}
          >
            微信内
          </button>
        </div>

        {qrImage ? (
          <div className="payment-checkout-qr">
            <img src={qrImage} alt="微信支付二维码" width={220} height={220} />
            <p>请使用微信扫一扫完成支付</p>
            {polling ? <span className="payment-checkout-polling">等待支付结果…</span> : null}
          </div>
        ) : (
          <div className="payment-checkout-actions">
            <button
              type="button"
              className="payment-channel-btn alipay"
              disabled={!!loading}
              onClick={() => launchPay("ALIPAY")}
            >
              {loading === "ALIPAY" ? <Loader2 size={16} className="animate-spin" /> : <span>支</span>}
              支付宝
              <small>{scene === "pc" ? "电脑网站" : "H5"}</small>
            </button>
            <button
              type="button"
              className="payment-channel-btn wechat"
              disabled={!!loading || wechatDisabled}
              title={wechatDisabled ? "微信内需 JSAPI，请使用支付宝" : undefined}
              onClick={() => launchPay("WECHAT")}
            >
              {loading === "WECHAT" ? <Loader2 size={16} className="animate-spin" /> : <span>微</span>}
              微信支付
              <small>{wechatDisabled ? "不可用" : scene === "pc" ? "扫码" : "H5"}</small>
            </button>
          </div>
        )}

        {error ? <p className="payment-checkout-error">{error}</p> : null}
      </div>
    </div>
  );
}