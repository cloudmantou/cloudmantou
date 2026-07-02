"use client";

import { useEffect, useRef, useState } from "react";

type TypingEffectProps = {
  /** 循环播放的短语列表 */
  phrases: string[];
  /** 打字速度（毫秒/字符） */
  typeSpeed?: number;
  /** 删除速度（毫秒/字符） */
  deleteSpeed?: number;
  /** 完整打出后停留时间（毫秒） */
  pauseAfterTyped?: number;
  /** 删除完毕后停留时间（毫秒） */
  pauseAfterDeleted?: number;
  className?: string;
};

/**
 * 打字机效果组件 —— 在首页副标题处循环播放多句短语，
 * 让落地页更有生命力。支持 prefers-reduced-motion 无障碍降级。
 */
export function TypingEffect({
  phrases,
  typeSpeed = 65,
  deleteSpeed = 32,
  pauseAfterTyped = 2200,
  pauseAfterDeleted = 480,
  className,
}: TypingEffectProps) {
  const [text, setText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const phraseIndex = useRef(0);
  const charIndex = useRef(0);
  const isDeleting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onChange = () => {
      reduced.current = mq.matches;
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced.current) {
      setText(phrases[0]);
      setShowCursor(false);
      return;
    }

    const tick = () => {
      const current = phrases[phraseIndex.current] ?? "";

      if (!isDeleting.current) {
        const next = current.slice(0, charIndex.current + 1);
        setText(next);
        charIndex.current += 1;

        if (charIndex.current >= current.length) {
          isDeleting.current = true;
          timer.current = setTimeout(tick, pauseAfterTyped);
          return;
        }
        timer.current = setTimeout(tick, typeSpeed);
      } else {
        const next = current.slice(0, charIndex.current - 1);
        setText(next);
        charIndex.current -= 1;

        if (charIndex.current <= 0) {
          isDeleting.current = false;
          phraseIndex.current = (phraseIndex.current + 1) % phrases.length;
          timer.current = setTimeout(tick, pauseAfterDeleted);
          return;
        }
        timer.current = setTimeout(tick, deleteSpeed);
      }
    };

    timer.current = setTimeout(tick, typeSpeed);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases.join("|"), typeSpeed, deleteSpeed, pauseAfterTyped, pauseAfterDeleted]);

  return (
    <span className={className} aria-label={phrases[0]}>
      {text}
      {showCursor && !reduced.current ? <span className="typing-cursor" aria-hidden="true" /> : null}
    </span>
  );
}
