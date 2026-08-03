"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CreditCard, KeyRound, LockKeyhole, Rocket, ShoppingBag } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { PaymentCheckout, type CheckoutOrder } from "@/components/payment/PaymentCheckout";
import type { Product } from "@/types";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";
import { localizeEditorialOrderTitle, localizeEditorialProduct } from "@/lib/editorial-commerce";
import { EditorialOrbitArt } from "@/components/editorial/EditorialOrbitArt";
import { readApiEnvelope } from "@/lib/client-api-response";

export function PricingPageClient() {
  const router = useRouter();
  const { locale, messages } = useOfficialI18n();
  const copy = messages.pages.pricing;
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && Boolean(session?.user);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState<CheckoutOrder | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { signal: controller.signal })
      .then(async (response) => {
        return readApiEnvelope(response, copy.loadError, locale !== "en");
      })
      .then((d) => {
        if (!Array.isArray(d.data)) throw new Error(copy.loadError);
        setProducts(d.data.map((product: Product) => localizeEditorialProduct(product, locale)));
        setError("");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : copy.loadError);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [copy.loadError, locale]);

  const handleBuy = (product: Product) => {
    if (status === "loading") return;
    if (!isLoggedIn) {
      const callbackUrl = localizeOfficialPath("/pricing", locale);
      router.push(`${localizeOfficialPath("/login", locale)}?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    if (!product.productType) return;
    setError("");

    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productType: product.productType,
        productId:
          product.productType === "CARD_PACKAGE" || product.productType === "PAID_POST"
            ? product.id
            : undefined,
      }),
    })
      .then(async (r) => {
        const data = await readApiEnvelope(r, copy.orderError, locale !== "en");
        if (!data.data || typeof data.data !== "object" || Array.isArray(data.data)) {
          throw new Error(copy.orderError);
        }
        const order = data.data as Record<string, unknown>;
        if (typeof order.id !== "string" || typeof order.orderNo !== "string" || typeof order.amount !== "number") {
          throw new Error(copy.orderError);
        }
        setCheckoutOrder({
          id: order.id,
          orderNo: order.orderNo,
          title: localizeEditorialOrderTitle(
            {
              title: typeof order.title === "string" ? order.title : product.name,
              productType: product.productType,
              productId: typeof order.productId === "string" ? order.productId : product.id,
              product,
            },
            locale
          ),
          amount: order.amount,
        });
        setCheckoutOpen(true);
      })
      .catch((orderError) => {
        setError(orderError instanceof Error ? orderError.message : copy.orderError);
      });
  };

  return (
    <>
      <div className="editorial-pricing-page">
        <section className="editorial-pricing-intro">
          <div className="editorial-container editorial-pricing-hero-grid">
            <div>
              <h1>{locale === "en" ? "Pricing & support" : "定价与支付"}</h1>
              <p>{copy.description}</p>
            </div>
            <EditorialOrbitArt label={locale === "en" ? "Membership support orbit" : "会员支持轨道插画"} />
          </div>
        </section>

        <section className="editorial-container editorial-pricing-body">
          <div className="editorial-pricing-notice">
            <span><LockKeyhole size={25} /></span>
            <div><strong>{copy.noticeTitle}</strong><p>{copy.noticeBody}</p></div>
          </div>

          <div className="editorial-purchase-flow" aria-label={locale === "en" ? "Purchase flow" : "购买流程"}>
            {[
              [ShoppingBag, locale === "en" ? "Choose" : "选择商品"],
              [CreditCard, locale === "en" ? "Pay" : "完成支付"],
              [KeyRound, locale === "en" ? "Receive" : "获取权益"],
              [Rocket, locale === "en" ? "Use" : "开始使用"],
            ].map(([Icon, label], index) => {
              const FlowIcon = Icon as typeof ShoppingBag;
              return <span key={String(label)}><FlowIcon size={22} /><b>{label as string}</b>{index < 3 ? <i aria-hidden="true">→</i> : null}</span>;
            })}
          </div>

          {error ? <p className="editorial-pricing-error" role="alert">{error}</p> : null}
          <div className="editorial-pricing-products product-grid">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                index={index}
                product={product}
                loggedIn={isLoggedIn}
                onBuy={handleBuy}
                onSelect={(selectedProduct) => {
                  setSelected(selectedProduct);
                  setDetailOpen(true);
                }}
              />
            ))}
          </div>
          {loading ? (
            <p className="editorial-pricing-state" aria-live="polite">{copy.loading}</p>
          ) : products.length === 0 && !error ? (
            <p className="editorial-pricing-state">{copy.empty}</p>
          ) : null}

          <section className="editorial-pricing-trust">
            {[
              [locale === "en" ? "Secure payment" : "安全支付", locale === "en" ? "Provider-signed payment requests" : "支付请求由服务端签名"],
              [locale === "en" ? "Automatic delivery" : "自动发货", locale === "en" ? "Benefits are delivered after payment" : "付款完成后自动交付权益"],
              [locale === "en" ? "Order history" : "订单留痕", locale === "en" ? "Review orders in the account center" : "会员中心可查询订单与交付"],
              [locale === "en" ? "Privacy" : "隐私保护", locale === "en" ? "Sensitive payment data stays with providers" : "敏感支付信息由支付平台处理"],
            ].map(([title, body]) => <div key={title}><strong>{title}</strong><p>{body}</p></div>)}
          </section>
        </section>
      </div>

      <ProductDetailModal
        product={selected}
        open={detailOpen}
        loggedIn={isLoggedIn}
        onClose={() => {
          setDetailOpen(false);
          setSelected(null);
        }}
        onBuy={(product) => {
          setDetailOpen(false);
          handleBuy(product);
        }}
      />

      <PaymentCheckout
        order={checkoutOrder}
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </>
  );
}
