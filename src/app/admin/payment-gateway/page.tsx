"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";

type GatewayId = "alipay" | "wechat" | "stripe" | "usdt" | "epay" | "vpay";

type GatewayData = {
  enabled?: boolean;
  mode?: string;
  env?: string;
  appId?: string;
  privateKey?: string;
  publicKey?: string;
  mchId?: string;
  apiKey?: string;
  apiV3Key?: string;
  platformSerial?: string;
  sellerId?: string;
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  currency?: string;
  network?: string;
  walletAddress?: string;
  rateSource?: string;
  rateMarkup?: string;
  orderTimeout?: string;
  confirmations?: string;
  pid?: string;
  key?: string;
  apiUrl?: string;
  hasPrivateKey?: boolean;
  hasPublicKey?: boolean;
  hasApiKey?: boolean;
  hasApiV3Key?: boolean;
  hasSecretKey?: boolean;
};

type PageData = {
  stats: {
    todayRevenue: number;
    todayOrders: number;
    pending: number;
    monthRefunds: number;
    successRate: number;
  };
  channelStats: Record<string, { amount: number; count: number }>;
  testMode: boolean;
  gateways: Record<GatewayId, GatewayData>;
  callbacks: Record<string, string>;
  webhooks: Array<{ event: string; code: string; url: string; status: string }>;
  recentTransactions: Array<{
    id: string;
    orderNo: string;
    title: string;
    channel: string;
    amount: number;
    status: string;
    orderStatus: string;
    createdAt: string;
  }>;
};

const GATEWAYS: Array<{
  id: GatewayId;
  name: string;
  sub: string;
  icon: string;
  iconClass: string;
  dbChannel?: string;
  fee: string;
}> = [
  { id: "alipay", name: "支付宝", sub: "Alipay · 当面付 / H5 / APP", icon: "支", iconClass: "alipay", dbChannel: "ALIPAY", fee: "0.6%" },
  { id: "wechat", name: "微信支付", sub: "WeChat Pay · JSAPI / Native / H5", icon: "微", iconClass: "wechat", dbChannel: "WECHAT", fee: "0.6%" },
  { id: "stripe", name: "Stripe", sub: "国际信用卡 · Apple Pay · Google Pay", icon: "S", iconClass: "stripe", fee: "2.9%+0.30" },
  { id: "usdt", name: "USDT 加密货币", sub: "TRC-20 / ERC-20 / BEP-20", icon: "₮", iconClass: "usdt", fee: "0%" },
  { id: "epay", name: "易支付", sub: "EPay · 聚合免签", icon: "E", iconClass: "epay", fee: "1.0%" },
  { id: "vpay", name: "V免签", sub: "VPay · 个人免签方案", icon: "V", iconClass: "vpay", fee: "—" },
];

const CHANNEL_BADGE: Record<string, string> = {
  ALIPAY: "purple",
  WECHAT: "wechat",
  CARD_KEY: "muted",
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  SUCCESS: { label: "已支付", className: "success" },
  WAITING: { label: "待确认", className: "warning" },
  FAILED: { label: "失败", className: "danger" },
  CLOSED: { label: "已关闭", className: "muted" },
};

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="admin-secret-field">
      <input
        className="admin-form-input mono"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button type="button" className="admin-secret-toggle" onClick={() => setShow((v) => !v)}>
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

export default function PaymentGatewayPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [gateways, setGateways] = useState<Record<string, GatewayData>>({});
  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openConfig, setOpenConfig] = useState<GatewayId | "webhook" | null>("alipay");
  const [toast, setToast] = useState("");

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payment-gateway");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setData(json.data);
      setGateways(json.data.gateways);
      setTestMode(json.data.testMode);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateGateway = (id: GatewayId, patch: Partial<GatewayData>) => {
    setGateways((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const toggleGateway = (id: GatewayId) => {
    updateGateway(id, { enabled: !gateways[id]?.enabled });
  };

  const saveGateway = async (id?: GatewayId) => {
    setSaving(true);
    try {
      const payload = id ? { gateways: { [id]: gateways[id] } } : { gateways, testMode };
      const res = await fetch("/api/admin/payment-gateway", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      flash("配置已保存");
      load();
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "保存失败");
    }
    setSaving(false);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => flash("已复制到剪贴板"));
  };

  const scrollToConfig = (id: GatewayId) => {
    setOpenConfig(id);
    document.getElementById(`cfg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const gatewayStatus = (id: GatewayId) => {
    const g = gateways[id];
    if (!g?.enabled) return { dot: "yellow", text: "未启用", color: "var(--orange)" };

    if (id === "alipay") {
      const ready = Boolean(g.appId && (g.privateKey || g.hasPrivateKey) && (g.publicKey || g.hasPublicKey));
      if (!ready) return { dot: "yellow", text: "未配置 · 缺少 AppID/密钥", color: "var(--orange)" };
      return { dot: "green", text: "凭证齐全 · 可发起支付", color: "var(--teal)" };
    }

    if (id === "wechat") {
      const hasV2Key = Boolean(g.apiKey || g.hasApiKey || g.apiV3Key || g.hasApiV3Key);
      const ready = Boolean(g.appId && g.mchId && hasV2Key);
      if (!ready) return { dot: "yellow", text: "未配置 · 缺少商户号/密钥", color: "var(--orange)" };
      return { dot: "green", text: "凭证齐全 · 可发起支付", color: "var(--teal)" };
    }

    if (id === "stripe") {
      return { dot: "yellow", text: "未实现 · 仅预留配置", color: "var(--orange)" };
    }
    if (id === "usdt") {
      if (!g.walletAddress) return { dot: "yellow", text: "未实现 · 请填写钱包地址", color: "var(--orange)" };
      return { dot: "yellow", text: "未实现 · 仅预留配置", color: "var(--orange)" };
    }
    if (id === "epay" || id === "vpay") {
      if (!g.apiUrl) return { dot: "yellow", text: "未实现 · 接口未配置", color: "var(--orange)" };
      return { dot: "yellow", text: "未实现 · 仅预留配置", color: "var(--orange)" };
    }

    return { dot: "yellow", text: "未实现", color: "var(--orange)" };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 48, color: "var(--text-muted)" }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>加载中...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2>支付对接</h2>
          <p>管理和配置支付网关、回调地址与通道凭证</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/payments" className="admin-btn admin-btn-ghost admin-btn-sm" style={{ textDecoration: "none" }}>
            <ExternalLink size={13} />
            支付流水
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => {
              const next = !testMode;
              setTestMode(next);
              fetch("/api/admin/payment-gateway", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testMode: next }),
              }).then(() => flash(next ? "测试模式已开启" : "测试模式已关闭"));
            }}
          >
            🧪 {testMode ? "关闭测试模式" : "切换测试模式"}
          </button>
        </div>
      </div>

      {testMode && (
        <div className="admin-test-banner">
          <div className="admin-test-banner-text">
            ⚠️ <strong>测试模式已开启</strong> — 当前所有交易均为模拟交易，不会产生真实扣款
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            style={{ background: "var(--orange)", color: "#000" }}
            onClick={() => {
              setTestMode(false);
              fetch("/api/admin/payment-gateway", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testMode: false }),
              });
            }}
          >
            关闭测试模式
          </button>
        </div>
      )}

      {data && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-label">💰 今日收入</div>
            <div className="admin-stat-value">¥{data.stats.todayRevenue.toFixed(0)}</div>
            <div className="admin-stat-sub">实时统计</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">📋 今日订单</div>
            <div className="admin-stat-value">{data.stats.todayOrders}</div>
            <div className="admin-stat-sub">
              成功率 <span className="admin-stat-up">{data.stats.successRate}%</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">⏳ 待处理</div>
            <div className="admin-stat-value">{data.stats.pending}</div>
            <div className="admin-stat-sub">需手动确认</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">↩️ 退款/争议</div>
            <div className="admin-stat-value">{data.stats.monthRefunds}</div>
            <div className="admin-stat-sub">本月共 {data.stats.monthRefunds} 笔</div>
          </div>
        </div>
      )}

      <div className="admin-section-title">🔌 支付通道</div>
      <div className="admin-section-desc">管理和配置您的支付网关。启用的支付方式将对用户可见。</div>

      <div className="admin-gateway-grid">
        {GATEWAYS.map((gw) => {
          const enabled = !!gateways[gw.id]?.enabled;
          const st = gatewayStatus(gw.id);
          const ch = gw.dbChannel ? data?.channelStats[gw.dbChannel] : undefined;
          return (
            <div key={gw.id} className={`admin-gateway-card${enabled ? " active" : " inactive"}`} id={`gw-${gw.id}`}>
              <div className="admin-gateway-header">
                <div className="admin-gateway-brand">
                  <div className={`admin-gateway-icon ${gw.iconClass}`}>{gw.icon}</div>
                  <div>
                    <div className="admin-gateway-name">{gw.name}</div>
                    <div className="admin-gateway-sub">{gw.sub}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className={`admin-toggle${enabled ? " on" : ""}`}
                  onClick={() => toggleGateway(gw.id)}
                  aria-label={`切换 ${gw.name}`}
                />
              </div>
              <div className="admin-gateway-body">
                <div className="admin-gateway-status">
                  <div className={`admin-status-dot ${st.dot}`} />
                  <span style={{ color: st.color }}>{st.text}</span>
                </div>
                <div className="admin-gateway-stats">
                  <div className="admin-g-stat">
                    今日 <strong>{ch ? `¥${ch.amount.toFixed(0)}` : "—"}</strong>
                  </div>
                  <div className="admin-g-stat">
                    订单 <strong>{ch?.count ?? 0}</strong>
                  </div>
                  <div className="admin-g-stat">
                    费率 <strong>{gw.fee}</strong>
                  </div>
                </div>
              </div>
              <div className="admin-gateway-footer">
                <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => scrollToConfig(gw.id)}>
                  ⚙ 配置
                </button>
                <Link href="/admin/payments" className="admin-btn admin-btn-ghost admin-btn-sm" style={{ textDecoration: "none" }}>
                  📊 报表
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-section-divider" />

      <div className="admin-section-title">⚙ 通道配置</div>
      <div className="admin-section-desc">填写各支付通道的 API 准入信息。所有密钥均加密存储。</div>

      {/* Alipay */}
      <div className="admin-config-card" id="cfg-alipay">
        <div className="admin-config-header" onClick={() => setOpenConfig(openConfig === "alipay" ? null : "alipay")}>
          <div className="admin-config-title">
            <div className="admin-gateway-icon alipay" style={{ width: 28, height: 28, fontSize: 14, borderRadius: 6 }}>支</div>
            支付宝配置
            <span className="admin-badge success">已连接</span>
          </div>
          <span className="admin-config-toggle" style={{ transform: openConfig === "alipay" ? "rotate(180deg)" : undefined }}>▾</span>
        </div>
        {openConfig === "alipay" && (
          <div className="admin-config-body">
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">应用模式</label>
                <select className="admin-form-select" value={gateways.alipay?.mode || "当面付"} onChange={(e) => updateGateway("alipay", { mode: e.target.value })}>
                  <option>当面付 (推荐)</option>
                  <option>H5 支付</option>
                  <option>APP 支付</option>
                  <option>电脑网站</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">环境</label>
                <select
                  className="admin-form-select"
                  value={gateways.alipay?.env === "sandbox" ? "sandbox" : "production"}
                  onChange={(e) => updateGateway("alipay", { env: e.target.value })}
                >
                  <option value="production">正式环境</option>
                  <option value="sandbox">沙箱环境</option>
                </select>
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">App ID</label>
                <input className="admin-form-input mono" value={gateways.alipay?.appId || ""} onChange={(e) => updateGateway("alipay", { appId: e.target.value })} placeholder="支付宝开放平台 App ID" />
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">应用私钥</label>
                <SecretInput value={gateways.alipay?.privateKey || ""} onChange={(v) => updateGateway("alipay", { privateKey: v })} placeholder="RSA2 私钥 (PKCS8 格式)" />
                <div className="admin-form-hint">使用 RSA2(SHA256) 签名，密钥长度 2048</div>
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">支付宝公钥</label>
                <SecretInput value={gateways.alipay?.publicKey || ""} onChange={(v) => updateGateway("alipay", { publicKey: v })} placeholder="支付宝公钥" />
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">回调地址</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="admin-form-input mono" readOnly value={data?.callbacks.alipay || ""} style={{ flex: 1 }} />
                  <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => copyText(data?.callbacks.alipay || "")}>复制</button>
                </div>
              </div>
            </div>
            <div className="admin-config-actions">
              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => flash("连接测试成功（模拟）")}>🔗 测试连接</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => updateGateway("alipay", { appId: "", privateKey: "", publicKey: "" })}>清空配置</button>
                <button type="button" className="admin-btn admin-btn-accent admin-btn-sm" disabled={saving} onClick={() => saveGateway("alipay")}>{saving ? "保存中..." : "保存配置"}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WeChat */}
      <div className="admin-config-card" id="cfg-wechat">
        <div className="admin-config-header" onClick={() => setOpenConfig(openConfig === "wechat" ? null : "wechat")}>
          <div className="admin-config-title">
            <div className="admin-gateway-icon wechat" style={{ width: 28, height: 28, fontSize: 14, borderRadius: 6 }}>微</div>
            微信支付配置
          </div>
          <span className="admin-config-toggle" style={{ transform: openConfig === "wechat" ? "rotate(180deg)" : undefined }}>▾</span>
        </div>
        {openConfig === "wechat" && (
          <div className="admin-config-body">
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">商户号 (mch_id)</label>
                <input className="admin-form-input mono" value={gateways.wechat?.mchId || ""} onChange={(e) => updateGateway("wechat", { mchId: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">AppID</label>
                <input className="admin-form-input mono" value={gateways.wechat?.appId || ""} onChange={(e) => updateGateway("wechat", { appId: e.target.value })} />
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">V2 商户 API 密钥</label>
                <SecretInput
                  value={gateways.wechat?.apiKey || ""}
                  onChange={(v) => updateGateway("wechat", { apiKey: v })}
                  placeholder="32 位密钥，用于统一下单签名与 V2 回调验签"
                />
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">API v3 密钥</label>
                <SecretInput
                  value={gateways.wechat?.apiV3Key || ""}
                  onChange={(v) => updateGateway("wechat", { apiV3Key: v })}
                  placeholder="32 位明文，用于 V3 回调解密"
                />
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">微信支付公钥 / 平台证书公钥</label>
                <SecretInput
                  value={gateways.wechat?.publicKey || ""}
                  onChange={(v) => updateGateway("wechat", { publicKey: v })}
                  placeholder="V3 回调验签用 PEM 公钥"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">平台证书序列号</label>
                <input
                  className="admin-form-input mono"
                  value={gateways.wechat?.platformSerial || ""}
                  onChange={(e) => updateGateway("wechat", { platformSerial: e.target.value })}
                  placeholder="Wechatpay-Serial"
                />
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">支付通知地址</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="admin-form-input mono" readOnly value={data?.callbacks.wechat || ""} style={{ flex: 1 }} />
                  <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => copyText(data?.callbacks.wechat || "")}>复制</button>
                </div>
              </div>
            </div>
            <div className="admin-config-actions">
              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => flash("连接测试成功（模拟）")}>🔗 测试连接</button>
              <button type="button" className="admin-btn admin-btn-accent admin-btn-sm" disabled={saving} onClick={() => saveGateway("wechat")}>保存配置</button>
            </div>
          </div>
        )}
      </div>

      {/* Stripe - collapsed by default */}
      <div className="admin-config-card" id="cfg-stripe">
        <div className="admin-config-header" onClick={() => setOpenConfig(openConfig === "stripe" ? null : "stripe")}>
          <div className="admin-config-title">
            <div className="admin-gateway-icon stripe" style={{ width: 28, height: 28, fontSize: 14, borderRadius: 6 }}>S</div>
            Stripe 配置
          </div>
          <span className="admin-config-toggle" style={{ transform: openConfig === "stripe" ? "rotate(180deg)" : undefined }}>▾</span>
        </div>
        {openConfig === "stripe" && (
          <div className="admin-config-body">
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">Publishable Key</label>
                <SecretInput value={gateways.stripe?.publishableKey || ""} onChange={(v) => updateGateway("stripe", { publishableKey: v })} placeholder="pk_live_xxx" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Secret Key</label>
                <SecretInput value={gateways.stripe?.secretKey || ""} onChange={(v) => updateGateway("stripe", { secretKey: v })} placeholder="sk_live_xxx" />
                <div className="admin-form-hint warn">⚠ 切勿在客户端暴露 Secret Key</div>
              </div>
              <div className="admin-form-group full">
                <label className="admin-form-label">Webhook 端点</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="admin-form-input mono" readOnly value={data?.callbacks.stripe || ""} style={{ flex: 1 }} />
                  <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => copyText(data?.callbacks.stripe || "")}>复制</button>
                </div>
              </div>
            </div>
            <div className="admin-config-actions">
              <button type="button" className="admin-btn admin-btn-accent admin-btn-sm" disabled={saving} onClick={() => saveGateway("stripe")}>保存配置</button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-section-divider" />

      <div className="admin-section-title">🔔 Webhook 通知</div>
      <div className="admin-section-desc">配置支付事件的回调通知，确保订单状态实时同步。</div>

      <div className="admin-config-card">
        <div className="admin-config-body" style={{ paddingTop: 18 }}>
          {data?.webhooks.map((wh) => (
            <div className="admin-webhook-item" key={wh.code}>
              <div className={`admin-status-dot ${wh.status === "ok" ? "green" : "yellow"}`} style={{ width: 12, height: 12 }} />
              <div className="admin-webhook-event">
                <strong>{wh.event}</strong> · {wh.code}
              </div>
              <div className="admin-webhook-url">{wh.url}</div>
              <div className="admin-webhook-status">
                <span className={`admin-badge ${wh.status === "ok" ? "success" : "warning"}`}>
                  {wh.status === "ok" ? "正常" : "待配置"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-section-divider" />

      <div className="admin-section-title">📋 近期交易</div>

      <div className="admin-table-wrap">
        <table className="admin-key-table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>渠道</th>
              <th>商品</th>
              <th>金额</th>
              <th>状态</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {!data?.recentTransactions.length ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>暂无交易记录</td>
              </tr>
            ) : (
              data.recentTransactions.map((tx) => {
                const st = STATUS_MAP[tx.status] || { label: tx.status, className: "muted" };
                const badgeClass = CHANNEL_BADGE[tx.channel] || "purple";
                return (
                  <tr key={tx.id}>
                    <td className="mono">{tx.orderNo}</td>
                    <td>
                      <span className={`admin-badge ${badgeClass}`}>
                        {tx.channel === "ALIPAY" ? "支付宝" : tx.channel === "WECHAT" ? "微信支付" : tx.channel}
                      </span>
                    </td>
                    <td>{tx.title}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>¥{tx.amount.toFixed(2)}</td>
                    <td><span className={`admin-badge ${st.className}`}>{st.label}</span></td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(tx.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "10px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, zIndex: 200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}