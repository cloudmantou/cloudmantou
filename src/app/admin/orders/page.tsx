"use client";

import { useState, useEffect } from "react";
import { Search, ExternalLink } from "lucide-react";

type Order = {
  id: string;
  orderNo: string;
  title: string;
  amount: number;
  status: string;
  productType: string;
  paidAt: string | null;
  createdAt: string;
  user: { username: string; nickname: string | null; email: string };
  payment: { channel: string; status: string; tradeNo: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "待支付",
  PAID: "已支付",
  CANCELLED: "已取消",
  REFUNDED: "已退款",
  EXPIRED: "已过期",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--orange)",
  PAID: "var(--teal)",
  CANCELLED: "var(--text-muted)",
  REFUNDED: "var(--rose)",
  EXPIRED: "var(--blue)",
};

const PRODUCT_LABELS: Record<string, string> = {
  VIP_MONTH: "月度会员",
  VIP_QUARTER: "季度会员",
  VIP_YEAR: "年度会员",
  PAID_POST: "付费文章",
  CARD_PACKAGE: "卡密套餐",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async (p: number) => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("q", search);
      const res = await fetch(`/api/admin/orders?${params}`);
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const data = await res.json();
      setOrders(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (e: any) {
      setLoadError(e.message || "加载失败");
    }
    setLoading(false);
  };

  useEffect(() => { load(page); }, [page, statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif', color: "var(--text)" }}>
            订单管理
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
            共 {total} 笔订单
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="搜索订单号/标题..."
            className="flex-1 px-3 py-1.5 rounded-md text-xs outline-none"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"DM Mono", monospace' }}
          />
          <button type="button" onClick={() => { setPage(1); load(1); }} className="p-1.5 rounded-md border transition-colors hover:border-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <Search size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex gap-1">
          {[{ id: "", label: "全部" }, { id: "PENDING", label: "待支付" }, { id: "PAID", label: "已支付" }, { id: "CANCELLED", label: "已取消" }].map((f) => (
            <button key={f.id} type="button" onClick={() => { setStatusFilter(f.id); setPage(1); }} className="px-2.5 py-1 rounded-md text-[10px] border transition-colors" style={{ borderColor: statusFilter === f.id ? "var(--accent)" : "var(--border)", background: statusFilter === f.id ? "var(--accent-dim)" : "transparent", color: statusFilter === f.id ? "var(--accent)" : "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--card)" }}>
              {["订单号", "用户", "商品", "金额", "状态", "支付方式", "时间"].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>加载中...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={7} className="text-center py-8 text-xs" style={{ color: "var(--rose)" }}>{loadError}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>暂无订单</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-3 py-2 text-xs" style={{ fontFamily: '"DM Mono", monospace', color: "var(--text)" }}>{o.orderNo}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{o.user.nickname || o.user.username}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <div>{o.title}</div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{PRODUCT_LABELS[o.productType]}</div>
                </td>
                <td className="px-3 py-2 text-xs font-medium" style={{ color: "var(--accent)", fontFamily: '"DM Mono", monospace' }}>¥{o.amount.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[o.status]}15`, color: STATUS_COLORS[o.status], fontFamily: '"DM Mono", monospace' }}>
                    {STATUS_LABELS[o.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>{o.payment?.channel || "—"}</td>
                <td className="px-3 py-2 text-[10px]" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
                  {new Date(o.createdAt).toLocaleDateString("zh-CN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)} className="w-7 h-7 rounded-md text-xs transition-colors" style={{ background: p === page ? "var(--accent)" : "transparent", color: p === page ? "var(--bg)" : "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
