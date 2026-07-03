import { CreditCard, Info, ShoppingCart } from "lucide-react";
import clsx from "clsx";
import type { Product } from "@/types";

type ProductCardProps = {
  product: Product;
  index?: number;
  onBuy: (product: Product) => void;
  onSelect?: (product: Product) => void;
};

export function ProductCard({ product, index = 0, onBuy, onSelect }: ProductCardProps) {
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
        aria-label={showDetail ? `查看 ${product.name} 详情` : undefined}
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
            <span className={product.stock <= 20 ? "stock-low" : undefined}>库存 {product.stock}</span>
          </div>
        </div>
      </button>

      <div className="product-actions">
        {showDetail ? (
          <button type="button" className="product-detail-btn" onClick={openDetail}>
            <Info size={14} aria-hidden="true" />
            查看介绍
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
          立即购买
        </button>
      </div>
    </article>
  );
}