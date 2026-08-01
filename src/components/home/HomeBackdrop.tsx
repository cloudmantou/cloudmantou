"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { isOfficialSite } from "@/config/site";

const SCROLL_PAUSE_MS = 200;

/**
 * 全站科幻氛围背景。官网模式使用 lite 层（更少模糊/动画），滚动时暂停动画减轻卡顿。
 */
export function HomeBackdrop() {
  const lite = isOfficialSite;

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;

    const setPaused = (paused: boolean) => {
      if (paused) {
        document.documentElement.dataset.backdropPaused = "true";
        return;
      }
      if (!document.hidden) {
        delete document.documentElement.dataset.backdropPaused;
      }
    };

    const onVisibility = () => setPaused(document.hidden);
    const onScroll = () => {
      setPaused(true);
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => setPaused(document.hidden), SCROLL_PAUSE_MS);
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", onScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
      delete document.documentElement.dataset.backdropPaused;
    };
  }, []);

  return (
    <div className={clsx("home-backdrop", lite && "home-backdrop--lite")} aria-hidden="true">
      <div className="home-backdrop-base" />
      {!lite ? (
        <>
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
        </>
      ) : (
        <>
          <div className="home-backdrop-aurora home-backdrop-aurora--a" />
          <div className="home-backdrop-orb home-backdrop-orb--gold" />
          <div className="home-backdrop-orb home-backdrop-orb--teal" />
          <div className="home-backdrop-grid" />
        </>
      )}
      <div className="home-backdrop-noise" />
      <div className="home-backdrop-readability" />
      <div className="home-backdrop-vignette" />
    </div>
  );
}