"use client";

/**
 * 首页氛围背景：多层渐变光晕，仅 home 区块展示
 */
export function HomeBackdrop() {
  return (
    <div className="home-backdrop" aria-hidden="true">
      <div className="home-backdrop-mesh" />
      <div className="home-backdrop-orb home-backdrop-orb--gold" />
      <div className="home-backdrop-orb home-backdrop-orb--teal" />
      <div className="home-backdrop-orb home-backdrop-orb--blue" />
      <div className="home-backdrop-orb home-backdrop-orb--rose" />
      <div className="home-backdrop-grid" />
    </div>
  );
}