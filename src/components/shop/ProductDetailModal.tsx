"use client";

import { useEffect, useRef } from "react";
import { Check, CreditCard, ShoppingCart, X } from "lucide-react";
import clsx from "clsx";
import type { Product } from "@/types";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { interpolateMessage } from "@/i18n/official";

type ProductDetailModalProps = {
  product: Product | null;
  open: boolean;
  loggedIn?: boolean;
  onClose: () => void;
  onBuy: (product: Product) => void;
};

export function ProductDetailModal({ product, open, loggedIn = true, onClose, onBuy }: ProductDetailModalProps) {
  const { messages } = useOfficialI18n();
  const copy = messages.product;
  const categoryLabel: Record<Product["category"], string> = {
    membership: copy.categories.membership,
    "paid-post": copy.categories.paidPost,
    card: copy.categories.card,
    service: copy.categories.service,
  };
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open || !product) return null;

  const canBuy = Boolean(product.productType);
  const isCard = product.category === "card";

  return (
    <div className="product-detail-overlay editorial-product-detail" role="dialog" aria-modal="true" aria-label={interpolateMessage(copy.details, { name: product.name })}>
      <button type="button" className="product-detail-backdrop" onClick={onClose} aria-label={copy.close} />
      <div ref={modalRef} className="product-detail-modal">
        <div
          className="product-detail-cover"
          style={{ backgroundImage: product.cover }}
        >
          <span className={clsx("product-badge", `badge-${product.accent}`)}>{product.badge}</span>
          <CreditCard size={48} aria-hidden="true" />
        </div>

        <div className="product-detail-body">
          <div className="product-detail-header">
            <div>
              <span className="product-detail-category">{categoryLabel[product.category]}</span>
              <h2 className="product-detail-title">{product.name}</h2>
              <p className="product-detail-summary">{product.description}</p>
            </div>
            <button ref={closeButtonRef} type="button" className="product-detail-close" onClick={onClose} aria-label={copy.close}>
              <X size={18} />
            </button>
          </div>

          {product.intro ? (
            <div className="product-detail-intro">
              {product.intro.split("\n\n").map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
          ) : null}

          {product.highlights && product.highlights.length > 0 ? (
            <ul className="product-detail-highlights">
              {product.highlights.map((item) => (
                <li key={item}>
                  <Check size={14} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {isCard && product.usageSteps && product.usageSteps.length > 0 ? (
            <div className="product-detail-steps">
              <h3>{copy.usage}</h3>
              <ol>
                {product.usageSteps.map((step, index) => (
                  <li key={step}>
                    <span className="product-detail-step-no">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="product-detail-footer">
            <div className="product-detail-price">
              <strong>{product.price}</strong>
              <span className={product.stock <= 20 ? "stock-low" : undefined}>{interpolateMessage(copy.stock, { count: product.stock })}</span>
            </div>
            <button
              type="button"
              className="buy-button product-detail-buy"
              disabled={!canBuy}
              onClick={() => onBuy(product)}
            >
              <ShoppingCart size={14} aria-hidden="true" />
              {!loggedIn ? copy.loginToBuy : canBuy ? copy.buyNow : copy.unavailable}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
