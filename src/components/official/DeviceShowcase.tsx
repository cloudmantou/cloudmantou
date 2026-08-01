"use client";

import { DeviceFrameSvg } from "@/components/official/DeviceFrameSvg";

const STORE_APPS = [
  {
    name: "香色闺阁",
    initial: "香",
    tagline: "纯净阅读 · 多源聚合",
    category: "阅读",
    featured: true,
    gradient: "linear-gradient(145deg, #ff6b8a 0%, #a855f7 100%)",
  },
  {
    name: "源阅读",
    initial: "源",
    tagline: "开源阅读器 · 自定义书源",
    category: "阅读",
    gradient: "linear-gradient(145deg, #2dd4bf 0%, #3b82f6 100%)",
  },
  {
    name: "地图定位助手",
    initial: "定",
    tagline: "虚拟定位 · 一键切换",
    category: "工具",
    gradient: "linear-gradient(145deg, #fb923c 0%, #fbbf24 100%)",
  },
] as const;

const FILTER_CHIPS = ["全部", "阅读", "工具"] as const;

export function DeviceShowcase() {
  return (
    <div className="device-showcase fade-up" style={{ animationDelay: "140ms" }}>
      <div className="device-stage-shadow" aria-hidden="true" />
      <div className="device-stage-glow" aria-hidden="true" />

      <div className="device-phone-3d">
        <div className="device-frame-stack">
          <div className="device-screen-inset">
            <div className="device-screen">
              <div className="device-wallpaper" aria-hidden="true" />

              <div className="device-island" aria-hidden="true">
                <span className="device-island-cam" />
              </div>

              <div className="device-status">
                <span className="device-status-time">9:41</span>
                <div className="device-status-icons" aria-hidden="true">
                  <span className="device-status-signal" />
                  <span className="device-status-wifi" />
                  <span className="device-status-battery" />
                </div>
              </div>

              <header className="device-store-nav">
                <span className="device-store-nav-title">应用商店</span>
                <span className="device-store-nav-badge">会员</span>
              </header>

              <div className="device-store-filters" aria-hidden="true">
                {FILTER_CHIPS.map((chip, index) => (
                  <span
                    key={chip}
                    className={`device-store-chip${index === 0 ? " is-active" : ""}`}
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="device-search-pill">
                <span className="device-search-icon" aria-hidden="true" />
                <span>搜索应用…</span>
              </div>

              <div className="device-store-list">
                {STORE_APPS.map((app) => (
                  <div key={app.name} className="device-store-row">
                    <div className="device-app-icon" style={{ background: app.gradient }}>
                      <span>{app.initial}</span>
                    </div>
                    <div className="device-store-row-body">
                      <div className="device-store-row-top">
                        <span className="device-store-row-name">{app.name}</span>
                        {"featured" in app && app.featured ? (
                          <span className="device-store-row-tag">精选</span>
                        ) : null}
                      </div>
                      <p className="device-store-row-tagline">{app.tagline}</p>
                      <span className="device-store-row-category">{app.category}</span>
                    </div>
                    <span className="device-store-install">安装</span>
                  </div>
                ))}
              </div>

              <div className="device-tabbar" aria-hidden="true">
                <span className="device-tab device-tab--active">
                  <span className="device-tab-icon device-tab-icon--store" />
                  商店
                </span>
                <span className="device-tab">
                  <span className="device-tab-icon device-tab-icon--map" />
                  定位
                </span>
                <span className="device-tab">
                  <span className="device-tab-icon device-tab-icon--user" />
                  我的
                </span>
              </div>
            </div>

            <div className="device-screen-glare" aria-hidden="true" />
            <div className="device-screen-edge" aria-hidden="true" />
          </div>

          <DeviceFrameSvg className="device-frame-overlay" />
        </div>
      </div>
    </div>
  );
}