"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ShieldCheck, UserX, Crown } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { readApiEnvelope } from "@/lib/client-api-response";

type UserItem = {
  id: string;
  username: string;
  email: string;
  nickname: string | null;
  role: string;
  vipLevel: number;
  vipExpireAt: string | null;
  createdAt: string;
  _count: { posts: number; comments: number; orders: number };
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理员",
  EDITOR: "编辑",
  USER: "用户",
};

const ROLE_TAG: Record<string, string> = {
  ADMIN: "tag-rose",
  EDITOR: "tag-accent",
  USER: "tag-muted",
};

type UserSummary = { total: number; admins: number; editors: number; activeVip: number };

function isVipActive(u: UserItem) {
  return u.vipLevel > 0 && Boolean(u.vipExpireAt) && new Date(u.vipExpireAt as string).getTime() > Date.now();
}

const ROLE_FILTERS = [
  { id: "", label: "全部" },
  { id: "ADMIN", label: "管理员" },
  { id: "EDITOR", label: "编辑" },
  { id: "USER", label: "用户" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: "20" });
        if (roleFilter) params.set("role", roleFilter);
        if (search) params.set("q", search);
        const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
        const body = await readApiEnvelope(res, "获取用户列表失败");
        const data = body.data as { items: UserItem[]; summary: UserSummary };
        const pagination = body.pagination as { total?: number; totalPages?: number } | undefined;
        setUsers(data.items || []);
        setSummary(data.summary || null);
        setTotal(pagination?.total || 0);
        setTotalPages(pagination?.totalPages || 1);
      } catch (e) {
        setUsers([]);
        setLoadError(e instanceof Error ? e.message : "获取用户列表失败");
      }
      setLoading(false);
    },
    [roleFilter, search]
  );

  useEffect(() => {
    load(page);
  }, [page, load]);

  const flash = (text: string, type: "ok" | "err" = "ok") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 2400);
  };

  const handleRoleChange = async (u: UserItem) => {
    const { id, role: currentRole } = u;
    const next = currentRole === "EDITOR" ? "USER" : "EDITOR";
    if (!window.confirm(`确定将「${u.nickname || u.username}」设为${ROLE_LABELS[next]}？`)) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      flash(data?.message || "更新失败", "err");
      return;
    }
    flash(`已设为${ROLE_LABELS[next]}`);
    load(page);
  };

  // 会员等级会直接影响付费权益：每次调整都明确告知结果，并防止连续误点。
  const handleVipBump = async (u: UserItem) => {
    const { id, vipLevel: currentLevel } = u;
    const next = currentLevel >= 3 ? 0 : currentLevel + 1;
    const name = u.nickname || u.username;
    const message = next === 0
      ? `确定取消「${name}」的会员？会员权益将立即失效。`
      : `确定将「${name}」的会员等级调整为 Lv.${next}？\n到期时间取“现有到期时间”和“今天起 30 天”中较晚者。`;
    if (!window.confirm(message)) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vipLevel: next }),
    });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      flash(data?.message || "更新失败", "err");
      return;
    }
    flash(next === 0 ? "已重置为免费用户" : `VIP 等级 → ${next}`);
    load(page);
  };

  return (
    <div>
      <div className="mb-6">
        <p className="home-greeting">Users</p>
        <h1 className="page-title">用户管理</h1>
        <p className="page-desc">查看、调整用户角色与 VIP 等级。</p>
      </div>

      {/* Summary */}
      <div className="metrics-grid mb-6">
        <div className="metric-card">
          <div className="metric-value">{summary?.total ?? "—"}</div>
          <div className="metric-label">用户总数</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary?.activeVip ?? "—"}</div>
          <div className="metric-label">有效会员</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary?.admins ?? "—"}</div>
          <div className="metric-label">管理员</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary?.editors ?? "—"}</div>
          <div className="metric-label">编辑</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="filter-row" style={{ alignItems: "center" }}>
        <div className="search-input" style={{ minWidth: 240, maxWidth: 320 }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setSearch(searchInput);
              }
            }}
            placeholder="搜索用户名、邮箱…"
          />
          <button
            type="button"
            aria-label="搜索"
            onClick={() => {
              setPage(1);
              setSearch(searchInput);
            }}
          >
            <Search size={14} aria-hidden="true" />
          </button>
        </div>
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setRoleFilter(f.id);
              setPage(1);
            }}
            className={`filter-button${roleFilter === f.id ? " active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="data-panel">
        <div className="data-panel-header">
          <span className="data-panel-title">用户列表</span>
          <span className="data-panel-meta">共 {total} 名</span>
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
        ) : users.length === 0 ? (
          <EmptyState
            title={search || roleFilter ? "没有匹配的用户" : "暂无用户"}
            description={search || roleFilter ? "换个关键词或筛选条件试试。" : "还没有注册用户。"}
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>VIP</th>
                  <th className="num">文章</th>
                  <th className="num">评论</th>
                  <th className="num">订单</th>
                  <th>注册时间</th>
                  <th className="action-col">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {(u.nickname || u.username)[0]?.toUpperCase()}
                        </div>
                        <div className="user-cell-meta">
                          <div className="user-cell-name">{u.nickname || u.username}</div>
                          <div className="user-cell-email mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`accent-tag ${ROLE_TAG[u.role] || "tag-muted"}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      {isVipActive(u) ? (
                        <span title={`到期：${new Date(u.vipExpireAt as string).toLocaleString("zh-CN")}`}>
                          <span className="vip-badge">
                            <Crown size={11} aria-hidden="true" />
                            Lv.{u.vipLevel}
                          </span>
                          <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
                            至 {new Date(u.vipExpireAt as string).toLocaleDateString("zh-CN")}
                          </span>
                        </span>
                      ) : u.vipLevel > 0 ? (
                        <span className="muted">已过期</span>
                      ) : (
                        <span className="muted">免费</span>
                      )}
                    </td>
                    <td className="num mono muted">{u._count.posts}</td>
                    <td className="num mono muted">{u._count.comments}</td>
                    <td className="num mono muted">{u._count.orders}</td>
                    <td className="muted">
                      {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="action-col">
                      <div className="row-actions">
                        {u.role !== "ADMIN" && (
                          <button
                            type="button"
                            onClick={() => void handleRoleChange(u)}
                            disabled={busyId !== null}
                            className="icon-action"
                            title={u.role === "EDITOR" ? "降级为用户" : "升级为编辑"}
                            aria-label={u.role === "EDITOR" ? "降级为用户" : "升级为编辑"}
                          >
                            {u.role === "EDITOR" ? (
                              <UserX size={14} aria-hidden="true" />
                            ) : (
                              <ShieldCheck size={14} aria-hidden="true" />
                            )}
                          </button>
                        )}
                        {u.role !== "ADMIN" && (
                        <button
                          type="button"
                          onClick={() => void handleVipBump(u)}
                          disabled={busyId !== null}
                          className="icon-action"
                          title={u.vipLevel >= 3 ? "重置 VIP" : "提升 VIP"}
                          aria-label={u.vipLevel >= 3 ? "重置 VIP" : "提升 VIP"}
                        >
                          <Crown size={14} aria-hidden="true" />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminPagination page={page} totalPages={totalPages} disabled={loading} onChange={setPage} />

      {toast && <div className={`toast ${toast.type === "err" ? "toast-err" : ""}`}>{toast.text}</div>}
    </div>
  );
}
