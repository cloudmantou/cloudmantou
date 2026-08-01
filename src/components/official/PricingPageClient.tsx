"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { PaymentCheckout, type CheckoutOrder } from "@/components/payment/PaymentCheckout";
import { PageHeader } from "@/components/official/sections";
import type { Product } from "@/types";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { localizeOfficialPath } from "@/i18n/official";

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
        const body = await response.json();
        if (!response.ok) throw new Error(locale === "en" ? copy.loadError : body.message || copy.loadError);
        return body;
      })
      .then((d) => {
        if (Array.isArray(d.data)) setProducts(d.data);
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
        const data = await r.json();
        if (!r.ok) throw new Error(locale === "en" ? copy.orderError : data.message || copy.orderError);
        setCheckoutOrder({
          id: data.data.id,
          orderNo: data.data.orderNo,
          title: data.data.title,
          amount: data.data.amount,
        });
        setCheckoutOpen(true);
      })
      .catch((orderError) => {
        setError(orderError instanceof Error ? orderError.message : copy.orderError);
      });
  };

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
      />
      <div className="official-container" style={{ paddingBottom: 48 }}>
        <div
          className="official-prose"
          style={{
            marginBottom: 20,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--card)",
          }}
        >
          <strong>{copy.noticeTitle}</strong>
          <p style={{ marginBottom: 0 }}>
            {copy.noticeBody}
          </p>
        </div>
        {error ? <p role="alert" style={{ color: "var(--rose)", marginBottom: 16 }}>{error}</p> : null}
        <div
          className="product-grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        >
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              index={index}
              product={product}
              loggedIn={isLoggedIn}
              onBuy={handleBuy}
              onSelect={(p) => {
                setSelected(p);
                setDetailOpen(true);
              }}
            />
          ))}
        </div>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>{copy.loading}</p>
        ) : products.length === 0 && !error ? (
          <p style={{ color: "var(--text-muted)" }}>{copy.empty}</p>
        ) : null}
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
