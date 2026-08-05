"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, Copy, Loader2, X } from "lucide-react";
import QRCode from "qrcode";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { interpolateMessage, localizeOfficialPath } from "@/i18n/official";
import { normalizeInternalReturnUrl } from "@/lib/return-url";
import { detectPaymentScene, type PaymentScene } from "@/lib/payment-scene";
import type { OrderFulfillment } from "@/lib/order-fulfillment";

export type CheckoutOrder = {
  id: string;
  orderNo: string;
  title: string;
  amount: number;
};

type PaymentReceipt = {
  orderNo: string;
  title: string;
  amount: number;
  fulfillment: OrderFulfillment;
};

type Props = {
  order: CheckoutOrder | null;
  open: boolean;
  onClose: () => void;
  onPaid?: () => void;
  returnPath?: string;
};

function detectClientScene(): PaymentScene {
  if (typeof navigator === "undefined") return "pc";
  return detectPaymentScene(navigator.userAgent);
}

function isPaymentReceipt(value: unknown): value is PaymentReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<PaymentReceipt>;
  return (
    typeof receipt.orderNo === "string" &&
    typeof receipt.title === "string" &&
    typeof receipt.amount === "number" &&
    Boolean(receipt.fulfillment)
  );
}

export function PaymentCheckout({ order, open, onClose, onPaid, returnPath }: Props) {
  const router = useRouter();
  const { locale, messages } = useOfficialI18n();
  const dashboardOrdersUrl = localizeOfficialPath("/dashboard?paid=1#orders", locale);
  const paidReturnPath = normalizeInternalReturnUrl(returnPath, dashboardOrdersUrl);
  const copy = messages.payment;
  const { data: session, status: sessionStatus } = useSession();
  const [scene, setScene] = useState<PaymentScene>("pc");
  const [loading, setLoading] = useState<"ALIPAY" | "WECHAT" | null>(null);
  const [error, setError] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [copied, setCopied] = useState<"cardNo" | "cardSecret" | null>(null);

  const onPaidRef = useRef(onPaid);
  const onCloseRef = useRef(onClose);
  const pollTimerRef = useRef<number | null>(null);
  const pollSequenceRef = useRef(0);
  const paidNotificationPendingRef = useRef(false);
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

  useEffect(() => () => {
    pollSequenceRef.current += 1;
    if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current);
  }, []);

  const finishPaid = useCallback((nextReceipt: PaymentReceipt) => {
    stopPolling();
    setQrUrl(null);
    setQrImage(null);
    setReceipt(nextReceipt);
    paidNotificationPendingRef.current = true;
  }, [stopPolling]);

  const notifyPaidOnce = useCallback(() => {
    if (!paidNotificationPendingRef.current) return;
    paidNotificationPendingRef.current = false;
    onPaidRef.current?.();
  }, []);

  const closeCheckout = useCallback(() => {
    notifyPaidOnce();
    onCloseRef.current();
  }, [notifyPaidOnce]);

  useEffect(() => {
    if (!open) {
      stopPolling();
      return;
    }
    if (sessionStatus === "unauthenticated") {
      onCloseRef.current();
      router.push(`${localizeOfficialPath("/login", locale)}?callbackUrl=${encodeURIComponent(paidReturnPath)}`);
      return;
    }
    if (sessionStatus === "loading") return;

    setScene(detectClientScene());
    setError("");
    setQrUrl(null);
    setQrImage(null);
    setPolling(false);
    setLoading(null);
    setReceipt(null);
    setCopied(null);
    paidNotificationPendingRef.current = false;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCheckout();
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
  }, [closeCheckout, locale, open, order?.id, paidReturnPath, router, sessionStatus, stopPolling]);

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
        if (!cancelled) setError(copy.qrFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.qrFailed, qrUrl]);

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
        const response = await fetch(`/api/payment/status?orderNo=${encodeURIComponent(orderNo)}`);
        const payload = await response.json();
        if (pollSequenceRef.current !== sequence) return;
        if (response.ok && payload.data?.status === "PAID" && !payload.data?.deliveryPending) {
          if (isPaymentReceipt(payload.data)) {
            finishPaid(payload.data);
            return;
          }
          setError(copy.receiptFailed);
        }
      } catch {
        if (Date.now() - started >= 5 * 60 * 1000) setError(copy.result.delayed);
      }
      if (pollSequenceRef.current !== sequence) return;
      if (Date.now() - started < 5 * 60 * 1000) {
        pollTimerRef.current = window.setTimeout(tick, 2500);
      } else {
        stopPolling();
      }
    };
    void tick();
  }, [copy.receiptFailed, copy.result.delayed, finishPaid, stopPolling]);

  const launchPay = async (channel: "ALIPAY" | "WECHAT") => {
    if (!order) return;
    setLoading(channel);
    setError("");
    setQrUrl(null);

    try {
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, channel, scene: "auto" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(locale === "en" ? copy.startFailed : data.message || copy.startFailed);
      }

      const payload = data.data;
      if (!payload || typeof payload !== "object") throw new Error(copy.unknownResponse);

      if (payload.type === "test") {
        const testResponse = await fetch("/api/payment/test-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });
        const testData = await testResponse.json();
        if (!testResponse.ok) {
          throw new Error(locale === "en" ? copy.simulateFailed : testData.message || copy.simulateFailed);
        }
        pollStatus(order.orderNo);
        return;
      }

      if (payload.type === "navigate" && payload.url) {
        window.location.href = payload.url;
        return;
      }
      if (payload.type === "form" && payload.html) {
        window.location.href = `/payment/alipay-launch?orderId=${encodeURIComponent(order.id)}&scene=auto`;
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
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : copy.failed);
    } finally {
      setLoading(null);
    }
  };

  const copyValue = async (kind: "cardNo" | "cardSecret", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setError(copy.copyFailed);
    }
  };

  const wechatDisabled = scene === "wechat_inapp";
  const fulfillmentMessage = receipt?.fulfillment.kind === "membership"
    ? copy.membershipDelivered
    : receipt?.fulfillment.kind === "article"
      ? copy.articleDelivered
      : receipt?.fulfillment.kind === "card" && !receipt.fulfillment.card
        ? copy.cardDelivering
        : null;
  if (!open || !order || sessionStatus !== "authenticated" || !session) return null;

  return (
    <div className="payment-checkout-overlay editorial-checkout" role="dialog" aria-modal="true" aria-labelledby="editorial-checkout-title">
      <button type="button" className="payment-checkout-backdrop" onClick={closeCheckout} aria-label={copy.close} />
      <div ref={modalRef} className="payment-checkout-modal editorial-checkout-panel">
        <div className="payment-checkout-header">
          <div>
            <div className="payment-checkout-title" id="editorial-checkout-title">
              {receipt ? copy.receiptTitle : copy.checkout}
            </div>
            <div className="payment-checkout-sub">
              {receipt ? copy.receiptSaved : `${copy.autoMode} · ${scene === "pc" ? copy.scenes.pc : scene === "wechat_inapp" ? copy.scenes.wechat : copy.scenes.h5}`}
            </div>
          </div>
          <button ref={closeButtonRef} type="button" className="payment-checkout-close" onClick={closeCheckout} aria-label={copy.close}>
            <X size={18} />
          </button>
        </div>

        {receipt ? (
          <div className="payment-checkout-receipt" aria-live="polite">
            <CheckCircle2 size={44} aria-hidden="true" />
            <h3>{copy.result.success}</h3>
            <dl>
              <div><dt>{copy.receiptOrder}</dt><dd>{receipt.orderNo}</dd></div>
              <div><dt>{copy.receiptAmount}</dt><dd>¥{receipt.amount.toFixed(2)}</dd></div>
            </dl>
            {receipt.fulfillment.card ? (
              <div className="payment-checkout-card-delivery">
                <div>
                  <span>{copy.cardNumber}</span>
                  <code>{receipt.fulfillment.card.cardNo}</code>
                  <button type="button" onClick={() => void copyValue("cardNo", receipt.fulfillment.card!.cardNo)}>
                    <Copy size={14} />{copied === "cardNo" ? copy.copied : copy.copy}
                  </button>
                </div>
                <div>
                  <span>{copy.cardSecret}</span>
                  <code>{receipt.fulfillment.card.cardSecret}</code>
                  <button type="button" onClick={() => void copyValue("cardSecret", receipt.fulfillment.card!.cardSecret)}>
                    <Copy size={14} />{copied === "cardSecret" ? copy.copied : copy.copy}
                  </button>
                </div>
              </div>
            ) : fulfillmentMessage ? (
              <p className="payment-checkout-fulfillment">{fulfillmentMessage}</p>
            ) : null}
            <p className="payment-checkout-save-hint">{copy.keepReceipt}</p>
            <div className="payment-checkout-receipt-actions">
              {paidReturnPath !== dashboardOrdersUrl ? <Link href={paidReturnPath} onClick={notifyPaidOnce}>{copy.continue}</Link> : null}
              <Link href={dashboardOrdersUrl} onClick={notifyPaidOnce}>{copy.result.viewOrders}</Link>
              <button type="button" onClick={closeCheckout}>{copy.close}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="payment-checkout-order editorial-checkout-order">
              <div className="payment-checkout-product">{order.title}</div>
              <div className="payment-checkout-amount"><span>¥</span>{order.amount.toFixed(2)}</div>
              <div className="payment-checkout-meta">{interpolateMessage(copy.orderNo, { orderNo: order.orderNo })}</div>
            </div>

            {qrImage ? (
              <div className="payment-checkout-qr">
                <img src={qrImage} alt={copy.qrAlt} width={220} height={220} />
                <p>{copy.qrPrompt}</p>
                {polling ? <span className="payment-checkout-polling">{copy.waiting}</span> : null}
              </div>
            ) : (
              <div className="payment-checkout-actions editorial-checkout-channels">
                <button type="button" className="payment-channel-btn alipay" disabled={Boolean(loading)} onClick={() => launchPay("ALIPAY")}>
                  {loading === "ALIPAY" ? <Loader2 size={16} className="animate-spin" /> : <span>支</span>}
                  {copy.alipay}
                  <small>{scene === "pc" ? copy.desktopWeb : copy.h5}</small>
                </button>
                <button type="button" className="payment-channel-btn wechat" disabled={Boolean(loading) || wechatDisabled} title={wechatDisabled ? copy.wechatUnavailableTitle : undefined} onClick={() => launchPay("WECHAT")}>
                  {loading === "WECHAT" ? <Loader2 size={16} className="animate-spin" /> : <span>微</span>}
                  {copy.wechatPay}
                  <small>{wechatDisabled ? copy.unavailable : scene === "pc" ? copy.scan : copy.h5}</small>
                </button>
              </div>
            )}
          </>
        )}

        {error ? <p className="payment-checkout-error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
