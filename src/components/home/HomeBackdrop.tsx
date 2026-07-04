"use client";

import { useEffect } from "react";

/**
 * 全站科幻氛围背景（CSS 轻量版）：光晕 / 极光 / 网格 / 星点，无 Canvas，避免阻塞主线程。
 */
export function HomeBackdrop() {
  useEffect(() => {
    const sync = () => {
      document.documentElement.dataset.backdropPaused = document.hidden ? "true" : "false";
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      delete document.documentElement.dataset.backdropPaused;
    };
  }, []);

  return (
    <div className="home-backdrop" aria-hidden="true">
      <div className="home-backdrop-base" />
      <div className="home-backdrop-sidebar-boost" />
      <div className="home-backdrop-nebula" />
      <div className="home-backdrop-hex" />
      <div className="home-backdrop-mesh" />
      <div className="home-backdrop-aurora home-backdrop-aurora--a" />
      <div className="home-backdrop-aurora home-backdrop-aurora--b" />
      <div className="home-backdrop-orb home-backdrop-orb--gold" />
      <div className="home-backdrop-orb home-backdrop-orb--teal" />
      <div className="home-backdrop-orb home-backdrop-orb--blue" />
      <div className="home-backdrop-grid" />
      <div className="home-backdrop-horizon" />
      <div className="home-backdrop-stars" />
      <div className="home-backdrop-beam" />
      <div className="home-backdrop-noise" />
      <div className="home-backdrop-readability" />
      <div className="home-backdrop-vignette" />
    </div>
  );
}