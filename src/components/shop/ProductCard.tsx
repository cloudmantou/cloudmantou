import { CreditCard, ShoppingCart } from "lucide-react";
import clsx from "clsx";
import type { Product } from "@/types";

type ProductCardProps = {
  product: Product;
  index?: number;
  onBuy: (product: Product) => void;
};

export function ProductCard({ product, index = 0, onBuy }: ProductCardProps) {
  return (
    <article className="product-card fade-up" style={{ animationDelay: `${index * 70}ms` }}>
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
        <button className="buy-button" type="button" onClick={() => onBuy(product)}>
          <ShoppingCart size={14} aria-hidden="true" />
          立即购买
        </button>
      </div>
    </article>
  );
}
