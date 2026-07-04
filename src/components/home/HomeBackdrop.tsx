"use client";

/**
 * 首页氛围背景：多层光晕 / 极光 / 星点 / 扫光，仅装饰层，不影响布局。
 */
export function HomeBackdrop() {
  return (
    <div className="home-backdrop" aria-hidden="true">
      <div className="home-backdrop-base" />
      <div className="home-backdrop-mesh" />
      <div className="home-backdrop-aurora home-backdrop-aurora--a" />
      <div className="home-backdrop-aurora home-backdrop-aurora--b" />
      <div className="home-backdrop-orb home-backdrop-orb--gold" />
      <div className="home-backdrop-orb home-backdrop-orb--teal" />
      <div className="home-backdrop-orb home-backdrop-orb--blue" />
      <div className="home-backdrop-orb home-backdrop-orb--rose" />
      <div className="home-backdrop-orb home-backdrop-orb--violet" />
      <div className="home-backdrop-grid" />
      <div className="home-backdrop-stars" />
      <div className="home-backdrop-beam" />
      <div className="home-backdrop-noise" />
      <div className="home-backdrop-vignette" />
    </div>
  );
}