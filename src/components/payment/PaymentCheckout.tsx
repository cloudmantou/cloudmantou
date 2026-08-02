"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Smartphone, Monitor, X } from "lucide-react";
import clsx from "clsx";
import QRCode from "qrcode";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { interpolateMessage, localizeOfficialPath } from "@/i18n/official";

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

const DASHBOARD_ORDERS_URL = "/dashboard?paid=1#orders";

export function PaymentCheckout({ order, open, onClose, onPaid }: Props) {
  const router = useRouter();
  const { locale, messages } = useOfficialI18n();
  const copy = messages.payment;
  const { data: session, status: sessionStatus } = useSession();
  const [scene, setScene] = useState<PaymentScene>("pc");
  const [loading, setLoading] = useState<"ALIPAY" | "WECHAT" | null>(null);
  const [error, setError] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const onPaidRef = useRef(onPaid);
  const onCloseRef = useRef(onClose);
  const pollTimerRef = useRef<number | null>(null);
  const pollSequenceRef = useRef(0);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const stopPolling = useCallback((updateState = true) => {
    pollSequenceRef.current += 1;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (updateState) setPolling(false);
  }, []);

  useEffect(() => {
    return () => {
      pollSequenceRef.current += 1;
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const finishPaid = useCallback(() => {
    stopPolling();
    onPaidRef.current?.();
    onCloseRef.current();
    router.push(DASHBOARD_ORDERS_URL);
  }, [router, stopPolling]);

  useEffect(() => {
    if (!open) {
      stopPolling();
      return;
    }
    if (sessionStatus === "unauthenticated") {
      onClose();
      router.push(`${localizeOfficialPath("/login", locale)}?callbackUrl=${encodeURIComponent(DASHBOARD_ORDERS_URL)}`);
      return;
    }
    if (sessionStatus === "loading") return;
    setScene(detectScene());
    setError("");
    setQrUrl(null);
    setQrImage(null);
    setPolling(false);
    setLoading(null);
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      stopPolling(false);
      previousFocus?.focus();
    };
  }, [locale, open, order?.id, sessionStatus, onClose, router, stopPolling]);

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
    stopPolling(false);
    const sequence = pollSequenceRef.current;
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
        if (pollSequenceRef.current !== sequence) return;
        if (data.data?.status === "PAID" && !data.data?.deliveryPending) {
          finishPaid();
          return;
        }
      } catch {
        // ignore
      }
      if (pollSequenceRef.current !== sequence) return;
      if (Date.now() - started < 5 * 60 * 1000) {
        pollTimerRef.current = window.setTimeout(tick, 2500);
      } else {
        stopPolling();
      }
    };
    void tick();
  }, [finishPaid, stopPolling]);

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
      if (!res.ok) throw new Error(locale === "en" ? copy.startFailed : data.message || copy.startFailed);

      const payload = data.data;

      if (payload.type === "test") {
        const testRes = await fetch("/api/payment/test-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });
        const testData = await testRes.json();
        if (!testRes.ok) throw new Error(locale === "en" ? copy.simulateFailed : testData.message || copy.simulateFailed);
        pollStatus(order.orderNo);
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

      throw new Error(copy.unknownResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.failed);
    } finally {
      setLoading(null);
    }
  };

  const wechatDisabled = scene === "wechat_inapp";

  if (!open || !order || sessionStatus !== "authenticated" || !session) return null;

  return (
    <div className="payment-checkout-overlay editorial-checkout" role="dialog" aria-modal="true" aria-labelledby="editorial-checkout-title">
      <button type="button" className="payment-checkout-backdrop" onClick={onClose} aria-label={copy.close} />
      <div ref={modalRef} className="payment-checkout-modal editorial-checkout-panel">
        <div className="payment-checkout-header">
          <div>
            <div className="payment-checkout-title" id="editorial-checkout-title">{copy.checkout}</div>
            <div className="payment-checkout-sub">{scene === "pc" ? copy.scenes.pc : scene === "wechat_inapp" ? copy.scenes.wechat : copy.scenes.h5}</div>
          </div>
          <button ref={closeButtonRef} type="button" className="payment-checkout-close" onClick={onClose} aria-label={copy.close}>
            <X size={18} />
          </button>
        </div>

        <div className="payment-checkout-order editorial-checkout-order">
          <div className="payment-checkout-product">{order.title}</div>
          <div className="payment-checkout-amount">
            <span>¥</span>
            {order.amount.toFixed(2)}
          </div>
          <div className="payment-checkout-meta">{interpolateMessage(copy.orderNo, { orderNo: order.orderNo })}</div>
        </div>

        <div className="payment-checkout-scene">
          <button
            type="button"
            className={clsx("payment-scene-btn", scene === "pc" && "active")}
            onClick={() => setScene("pc")}
            aria-pressed={scene === "pc"}
          >
            <Monitor size={14} />
            {copy.desktop}
          </button>
          <button
            type="button"
            className={clsx("payment-scene-btn", scene === "h5" && "active")}
            onClick={() => setScene("h5")}
            aria-pressed={scene === "h5"}
          >
            <Smartphone size={14} />
            {copy.mobileH5}
          </button>
          <button
            type="button"
            className={clsx("payment-scene-btn", scene === "wechat_inapp" && "active")}
            onClick={() => setScene("wechat_inapp")}
            aria-pressed={scene === "wechat_inapp"}
          >
            {copy.wechatInApp}
          </button>
        </div>

        {qrImage ? (
          <div className="payment-checkout-qr">
            <img src={qrImage} alt={copy.qrAlt} width={220} height={220} />
            <p>{copy.qrPrompt}</p>
            {polling ? <span className="payment-checkout-polling">{copy.waiting}</span> : null}
          </div>
        ) : (
          <div className="payment-checkout-actions editorial-checkout-channels">
            <button
              type="button"
              className="payment-channel-btn alipay"
              disabled={!!loading}
              onClick={() => launchPay("ALIPAY")}
            >
              {loading === "ALIPAY" ? <Loader2 size={16} className="animate-spin" /> : <span>支</span>}
              {copy.alipay}
              <small>{scene === "pc" ? copy.desktopWeb : copy.h5}</small>
            </button>
            <button
              type="button"
              className="payment-channel-btn wechat"
              disabled={!!loading || wechatDisabled}
              title={wechatDisabled ? copy.wechatUnavailableTitle : undefined}
              onClick={() => launchPay("WECHAT")}
            >
              {loading === "WECHAT" ? <Loader2 size={16} className="animate-spin" /> : <span>微</span>}
              {copy.wechatPay}
              <small>{wechatDisabled ? copy.unavailable : scene === "pc" ? copy.scan : copy.h5}</small>
            </button>
          </div>
        )}

        {error ? <p className="payment-checkout-error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
