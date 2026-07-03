"use client";

import { useEffect } from "react";
import { Check, CreditCard, ShoppingCart, X } from "lucide-react";
import clsx from "clsx";
import type { Product } from "@/types";

type ProductDetailModalProps = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onBuy: (product: Product) => void;
};

const categoryLabel: Record<Product["category"], string> = {
  membership: "会员套餐",
  "paid-post": "付费内容",
  card: "卡密商品",
  service: "增值服务",
};

export function ProductDetailModal({ product, open, onClose, onBuy }: ProductDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !product) return null;

  const canBuy = Boolean(product.productType);
  const isCard = product.category === "card";

  return (
    <div className="product-detail-overlay" role="dialog" aria-modal="true" aria-label={`${product.name} 详情`}>
      <button type="button" className="product-detail-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="product-detail-modal">
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
            <button type="button" className="product-detail-close" onClick={onClose} aria-label="关闭">
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
              <h3>使用方式</h3>
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
              <span className={product.stock <= 20 ? "stock-low" : undefined}>库存 {product.stock}</span>
            </div>
            <button
              type="button"
              className="buy-button product-detail-buy"
              disabled={!canBuy}
              onClick={() => onBuy(product)}
            >
              <ShoppingCart size={14} aria-hidden="true" />
              {canBuy ? "立即购买" : "暂未开放"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}