"use client";

import { useState, useTransition, useCallback } from "react";
import { ThumbsUp } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type LikeButtonProps = {
  slug: string;
  initialLiked: boolean;
  initialCount: number;
};

export function LikeButton({ slug, initialLiked, initialCount }: LikeButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState(false);

  const handleLike = useCallback(() => {
    if (!session?.user) {
      router.push("/login");
      return;
    }
    if (isPending || cooldown) return;

    // Optimistic update
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    setCooldown(true);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/posts/${slug}/like`, { method: "POST" });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setLiked(data.data.liked);
        setCount(data.data.likeCount);
      } catch {
        // Rollback on error
        setLiked(prevLiked);
        setCount(prevCount);
      }
      setTimeout(() => setCooldown(false), 500);
    });
  }, [session, slug, liked, count, isPending, cooldown, router]);

  return (
    <button
      type="button"
      onClick={handleLike}
      disabled={isPending}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200"
      style={{
        borderColor: liked ? "var(--accent)" : "var(--border)",
        background: liked ? "var(--accent-dim)" : "transparent",
        color: liked ? "var(--accent)" : "var(--text-secondary)",
        fontFamily: '"DM Mono", monospace',
        fontSize: "13px",
        opacity: isPending ? 0.7 : 1,
        transform: isPending ? "scale(0.95)" : "scale(1)",
      }}
      aria-label={liked ? "取消点赞" : "点赞"}
    >
      <ThumbsUp
        size={16}
        fill={liked ? "currentColor" : "none"}
        aria-hidden="true"
        style={{ transition: "transform 200ms ease", transform: isPending ? "scale(1.2)" : "scale(1)" }}
      />
      <span>{count}</span>
    </button>
  );
}
