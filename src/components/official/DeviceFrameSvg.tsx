type DeviceFrameSvgProps = {
  className?: string;
};

export function DeviceFrameSvg({ className }: DeviceFrameSvgProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 820"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="device-titanium" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9a9bac" />
          <stop offset="12%" stopColor="#5e5f72" />
          <stop offset="28%" stopColor="#2a2b38" />
          <stop offset="48%" stopColor="#0a0b12" />
          <stop offset="62%" stopColor="#1e1f2c" />
          <stop offset="78%" stopColor="#4a4b5e" />
          <stop offset="92%" stopColor="#7d7e90" />
          <stop offset="100%" stopColor="#a8a9ba" />
        </linearGradient>

        <linearGradient id="device-titanium-shine" x1="18%" y1="0%" x2="72%" y2="42%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="38%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        <linearGradient id="device-btn-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6d6e80" />
          <stop offset="100%" stopColor="#2c2d3a" />
        </linearGradient>

        <filter id="device-frame-shadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="28" stdDeviation="28" floodColor="#000" floodOpacity="0.55" />
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity="0.35" />
        </filter>

        <mask id="device-bezel-mask">
          <rect width="400" height="820" fill="white" />
          <rect x="13" y="13" width="374" height="794" rx="49" ry="49" fill="black" />
        </mask>
      </defs>

      <g filter="url(#device-frame-shadow)">
        <rect width="400" height="820" rx="58" fill="url(#device-titanium)" mask="url(#device-bezel-mask)" />
        <rect width="400" height="820" rx="58" fill="url(#device-titanium-shine)" mask="url(#device-bezel-mask)" opacity="0.85" />
      </g>

      <rect
        x="13.5"
        y="13.5"
        width="373"
        height="793"
        rx="48.5"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1"
        fill="none"
      />
      <rect
        x="12"
        y="12"
        width="376"
        height="796"
        rx="50"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth="2"
        fill="none"
      />

      {/* 天线断点 */}
      <rect x="118" y="3" width="5" height="2" rx="1" fill="rgba(255,255,255,0.1)" />
      <rect x="277" y="815" width="5" height="2" rx="1" fill="rgba(255,255,255,0.08)" />

      {/* 左侧按键 */}
      <rect x="0" y="108" width="2.5" height="24" rx="1" fill="url(#device-btn-fill)" />
      <rect x="0" y="150" width="2.5" height="42" rx="1" fill="url(#device-btn-fill)" />
      <rect x="0" y="202" width="2.5" height="42" rx="1" fill="url(#device-btn-fill)" />

      {/* 电源键 */}
      <rect x="397.5" y="166" width="2.5" height="62" rx="1" fill="url(#device-btn-fill)" />

      {/* 边框高光 */}
      <path
        d="M58 2 C120 2 280 2 342 2"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}