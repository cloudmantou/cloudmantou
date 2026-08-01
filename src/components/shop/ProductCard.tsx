"use client";

import { CreditCard, Info, ShoppingCart } from "lucide-react";
import clsx from "clsx";
import type { Product } from "@/types";
import { useOfficialI18n } from "@/i18n/OfficialI18nProvider";
import { interpolateMessage } from "@/i18n/official";

type ProductCardProps = {
  product: Product;
  index?: number;
  loggedIn?: boolean;
  onBuy: (product: Product) => void;
  onSelect?: (product: Product) => void;
};

export function ProductCard({ product, index = 0, loggedIn = true, onBuy, onSelect }: ProductCardProps) {
  const { messages } = useOfficialI18n();
  const copy = messages.product;
  const showDetail = product.category === "card" || Boolean(product.intro);

  const openDetail = () => {
    if (showDetail && onSelect) onSelect(product);
  };

  return (
    <article
      className={clsx("product-card fade-up", showDetail && "product-card--interactive")}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <button
        type="button"
        className="product-card-hit"
        onClick={openDetail}
        disabled={!showDetail}
        aria-label={showDetail ? interpolateMessage(copy.viewDetails, { name: product.name }) : undefined}
      >
        <div className="product-cover" style={{ backgroundImage: product.cover }}>
          <span className={clsx("product-badge", `badge-${product.accent}`)}>{product.badge}</span>
          <CreditCard size={40} aria-hidden="true" />
        </div>
        <div className="product-content">
          <h3>{product.name}</h3>
          <p>{product.description}</p>
          <div className="product-row">
            <strong>{product.price}</strong>
            <span className={product.stock <= 20 ? "stock-low" : undefined}>{interpolateMessage(copy.stock, { count: product.stock })}</span>
          </div>
        </div>
      </button>

      <div className="product-actions">
        {showDetail ? (
          <button type="button" className="product-detail-btn" onClick={openDetail}>
            <Info size={14} aria-hidden="true" />
            {copy.introduction}
          </button>
        ) : null}
        <button
          className="buy-button"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBuy(product);
          }}
        >
          <ShoppingCart size={14} aria-hidden="true" />
          {loggedIn ? copy.buyNow : copy.loginToBuy}
        </button>
      </div>
    </article>
  );
}
