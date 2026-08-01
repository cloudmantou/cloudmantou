"use client";

const ORBIT_APPS = [
  {
    name: "香色闺阁",
    initial: "香",
    gradient: "linear-gradient(145deg, #ff6b8a, #a855f7)",
    angle: 0,
  },
  {
    name: "源阅读",
    initial: "源",
    gradient: "linear-gradient(145deg, #2dd4bf, #3b82f6)",
    angle: 120,
  },
  {
    name: "定位助手",
    initial: "定",
    gradient: "linear-gradient(145deg, #fb923c, #fbbf24)",
    angle: 240,
  },
] as const;

const FLOW_STEPS = ["选择商品", "交付权益", "打开商店", "按配置安装"] as const;

export function HeroMotionVisual() {
  return (
    <div className="hero-motion fade-up" style={{ animationDelay: "140ms" }} aria-hidden="true">
      <div className="hero-motion-stage">
        <div className="hero-motion-halo" />
        <div className="hero-motion-ring hero-motion-ring--outer" />
        <div className="hero-motion-ring hero-motion-ring--mid" />
        <div className="hero-motion-ring hero-motion-ring--inner" />

        <svg className="hero-motion-lines" viewBox="0 0 420 420" fill="none">
          <defs>
            <linearGradient id="hero-beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e8b964" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#e8b964" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#6b9aff" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <circle cx="210" cy="210" r="148" className="hero-motion-orbit-track" />
          {ORBIT_APPS.map((app) => {
            const rad = ((app.angle - 90) * Math.PI) / 180;
            const x = 210 + Math.cos(rad) * 148;
            const y = 210 + Math.sin(rad) * 148;
            return (
              <line
                key={app.name}
                x1="210"
                y1="210"
                x2={x}
                y2={y}
                className="hero-motion-beam"
              />
            );
          })}
        </svg>

        <div className="hero-motion-orbit">
          {ORBIT_APPS.map((app) => (
            <div
              key={app.name}
              className="hero-motion-node"
              style={{ ["--orbit-angle" as string]: `${app.angle}deg` }}
            >
              <div className="hero-motion-node-card">
                <div className="hero-motion-node-icon" style={{ background: app.gradient }}>
                  <span>{app.initial}</span>
                </div>
                <span className="hero-motion-node-label">{app.name}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="hero-motion-core">
          <div className="hero-motion-core-glow" />
          <div className="hero-motion-core-inner">
            <span className="hero-motion-core-mark">馒</span>
          </div>
          <span className="hero-motion-core-name">馒头助手</span>
        </div>

        <div className="hero-motion-chip hero-motion-chip--tl">内置商店</div>
        <div className="hero-motion-chip hero-motion-chip--tr">虚拟定位</div>
        <div className="hero-motion-chip hero-motion-chip--bl">iOS 15+</div>
        <div className="hero-motion-chip hero-motion-chip--br">权益透明</div>

        <div className="hero-motion-flow">
          {FLOW_STEPS.map((step, index) => (
            <span key={step} className="hero-motion-flow-item">
              <span
                className="hero-motion-flow-dot"
                style={{ animationDelay: `${index * 0.8}s` }}
              />
              {step}
              {index < FLOW_STEPS.length - 1 ? (
                <span className="hero-motion-flow-arrow" aria-hidden="true" />
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
