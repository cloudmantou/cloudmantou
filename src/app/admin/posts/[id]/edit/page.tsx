"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PostEditor } from "@/components/admin/PostEditor";

export default function EditPostPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/posts/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("加载失败");
        return r.json();
      })
      .then((d) => setPost(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="text-center py-12 text-xs" style={{ color: "var(--text-muted)" }}>
        加载中...
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-sm mb-4" style={{ color: "var(--rose)" }}>{error || "文章不存在"}</p>
        <button
          type="button"
          onClick={() => router.push("/admin/posts")}
          className="text-xs"
          style={{ color: "var(--accent)" }}
        >
          返回文章列表
        </button>
      </div>
    );
  }

  return <PostEditor mode="edit" initialData={post} />;
}
