"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ShieldCheck, Shield, UserX, Crown } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: "20" });
        if (roleFilter) params.set("role", roleFilter);
        if (search) params.set("q", search);
        const res = await fetch(`/api/admin/users?${params}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        setUsers(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch {
        setUsers([]);
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

  const handleRoleChange = async (id: string, currentRole: string) => {
    const next = currentRole === "EDITOR" ? "USER" : "EDITOR";
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      flash(data?.message || "更新失败", "err");
      return;
    }
    flash(`已设为${ROLE_LABELS[next]}`);
    load(page);
  };

  const handleVipBump = async (id: string, currentLevel: number) => {
    const next = currentLevel >= 3 ? 0 : currentLevel + 1;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vipLevel: next }),
    });
    const data = await res.json().catch(() => null);
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
          <div className="metric-value">{total}</div>
          <div className="metric-label">用户总数</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {users.filter((u) => u.vipLevel > 0).length}
            <span className="metric-delta muted">/ {users.length}</span>
          </div>
          <div className="metric-label">VIP / 列表内</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {users.filter((u) => u.role === "ADMIN").length}
          </div>
          <div className="metric-label">管理员</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {users.filter((u) => u.role === "EDITOR").length}
          </div>
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
        ) : users.length === 0 ? (
          <EmptyState title="暂无用户" description="还没有注册用户。" />
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
                      {u.vipLevel > 0 ? (
                        <span className="vip-badge">
                          <Crown size={11} aria-hidden="true" />
                          Lv.{u.vipLevel}
                        </span>
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
                            onClick={() => handleRoleChange(u.id, u.role)}
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
                        <button
                          type="button"
                          onClick={() => handleVipBump(u.id, u.vipLevel)}
                          className="icon-action"
                          title={u.vipLevel >= 3 ? "重置 VIP" : "提升 VIP"}
                          aria-label={u.vipLevel >= 3 ? "重置 VIP" : "提升 VIP"}
                        >
                          <Crown size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`pagination-item${p === page ? " active" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {toast && <div className={`toast ${toast.type === "err" ? "toast-err" : ""}`}>{toast.text}</div>}
    </div>
  );
}
