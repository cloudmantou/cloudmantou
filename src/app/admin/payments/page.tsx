"use client";

import { useState, useEffect, useCallback } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { readApiEnvelope } from "@/lib/client-api-response";

type PaymentItem = {
  id: string;
  orderId: string;
  tradeNo: string | null;
  channel: string;
  amount: number;
  status: string;
  createdAt: string;
  order: {
    orderNo: string;
    title: string;
    user: { username: string; nickname: string | null };
  };
};

type PaymentStats = {
  total: number;
  success: number;
  successAmount: number;
  failed: number;
  waiting: number;
};

const STATUS_LABELS: Record<string, string> = {
  WAITING: "等待中",
  SUCCESS: "成功",
  FAILED: "失败",
  CLOSED: "已关闭",
};

const STATUS_CLASS: Record<string, string> = {
  WAITING: "tag-orange",
  SUCCESS: "tag-teal",
  FAILED: "tag-rose",
  CLOSED: "tag-muted",
};

const CHANNEL_LABELS: Record<string, string> = {
  ALIPAY: "支付宝",
  WECHAT: "微信支付",
  CARD_KEY: "卡密兑换",
};

const STATUS_FILTERS = [
  { id: "", label: "全部" },
  { id: "SUCCESS", label: "成功" },
  { id: "WAITING", label: "等待中" },
  { id: "FAILED", label: "失败" },
  { id: "CLOSED", label: "已关闭" },
];

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: "20" });
        if (statusFilter) params.set("status", statusFilter);
        const res = await fetch(`/api/admin/payments?${params}`, { cache: "no-store" });
        const body = await readApiEnvelope(res, "获取支付记录失败");
        const data = body.data as { items: PaymentItem[]; summary: PaymentStats };
        const pagination = body.pagination as { total?: number; totalPages?: number } | undefined;
        setPayments(data.items || []);
        setStats(data.summary || null);
        setTotal(pagination?.total || 0);
        setTotalPages(pagination?.totalPages || 1);
      } catch (e) {
        setPayments([]);
        setLoadError(e instanceof Error ? e.message : "获取支付记录失败");
      }
      setLoading(false);
    },
    [statusFilter]
  );

  useEffect(() => {
    load(page);
  }, [page, load]);

  return (
    <div>
      <div className="mb-6">
        <p className="home-greeting">Payments</p>
        <h1 className="page-title">支付记录</h1>
        <p className="page-desc">查看所有支付流水与渠道对账。</p>
      </div>

      {/* Summary metrics */}
      <div className="metrics-grid mb-6">
        <div className="metric-card">
          <div className="metric-value">{stats?.total ?? "—"}</div>
          <div className="metric-label">流水总数</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{stats ? `¥${stats.successAmount.toFixed(2)}` : "—"}</div>
          <div className="metric-label">累计成功金额</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{stats?.success ?? 0}</div>
          <div className="metric-label">成功笔数</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {stats?.waiting ?? 0}
            <span className="metric-delta" style={{ color: "var(--rose)" }}>/{stats?.failed ?? 0}</span>
          </div>
          <div className="metric-label">等待中 / 失败</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setStatusFilter(f.id);
              setPage(1);
            }}
            className={`filter-button${statusFilter === f.id ? " active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="data-panel">
        <div className="data-panel-header">
          <span className="data-panel-title">流水列表</span>
          <span className="data-panel-meta">共 {total} 条</span>
        </div>
        {loading ? (
          <div className="data-panel-loading">加载中…</div>
        ) : loadError ? (
          <div className="data-panel-loading" role="alert" style={{ color: "var(--rose)" }}>
            {loadError}
            <button type="button" className="filter-button" style={{ marginLeft: 10 }} onClick={() => load(page)}>
              重试
            </button>
          </div>
        ) : payments.length === 0 ? (
          <EmptyState title="暂无支付记录" description="还没有任何支付流水。" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>流水号</th>
                  <th>订单号</th>
                  <th>用户</th>
                  <th className="num">金额</th>
                  <th>渠道</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.tradeNo || p.id.slice(0, 12)}</td>
                    <td className="mono muted">{p.order.orderNo}</td>
                    <td>{p.order.user.nickname || p.order.user.username}</td>
                    <td className={`num mono ${p.status === "SUCCESS" ? "amount" : "muted"}`}>
                      ¥{Number(p.amount).toFixed(2)}
                    </td>
                    <td>{CHANNEL_LABELS[p.channel] || p.channel}</td>
                    <td>
                      <span className={`accent-tag ${STATUS_CLASS[p.status] || "tag-muted"}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="muted">{new Date(p.createdAt).toLocaleString("zh-CN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminPagination page={page} totalPages={totalPages} disabled={loading} onChange={setPage} />
    </div>
  );
}
