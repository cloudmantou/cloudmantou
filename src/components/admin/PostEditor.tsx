"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Eye, Send } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type Category = { id: string; name: string; slug: string };
type Tag = { id: string; name: string; slug: string };

type PostEditorProps = {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    coverImage: string | null;
    categoryId: string | null;
    tags: Array<{ id: string }>;
    status: string;
    isTop: boolean;
    paidContent: { content: string; price: number } | null;
  };
};

export function PostEditor({ mode, initialData }: PostEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [coverImage, setCoverImage] = useState(initialData?.coverImage || "");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initialData?.tags?.map((t) => t.id) || []
  );
  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  const [isTop, setIsTop] = useState(initialData?.isTop || false);
  const [isPaid, setIsPaid] = useState(initialData?.status === "PAID_ONLY");
  const [paidContent, setPaidContent] = useState(initialData?.paidContent?.content || "");
  const [paidPrice, setPaidPrice] = useState(initialData?.paidContent?.price?.toString() || "");

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState("");
  const [slugEdited, setSlugEdited] = useState(mode === "edit");

  // Load categories and tags
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/tags").then((r) => r.json()),
    ]).then(([cats, tgs]) => {
      setCategories(cats.data || []);
      setTags(tgs.data || []);
    });
  }, []);

  // Auto-generate slug from title
  useEffect(() => {
    if (slugEdited) return;
    const generated = title
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    setSlug(generated);
  }, [title, slugEdited]);

  const handleSave = (publishStatus: string) => {
    if (!title.trim() || !content.trim()) {
      setError("标题和内容不能为空");
      return;
    }
    if (!slug.trim()) {
      setError("slug 不能为空");
      return;
    }
    setError("");

    const finalStatus = publishStatus || status;

    startTransition(async () => {
      try {
        const url = mode === "create" ? "/api/admin/posts" : `/api/admin/posts/${initialData?.id}`;
        const method = mode === "create" ? "POST" : "PUT";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim(),
            excerpt: excerpt.trim() || null,
            content,
            coverImage: coverImage.trim() || null,
            categoryId: categoryId || null,
            tagIds: selectedTagIds,
            status: finalStatus,
            isTop,
            ...(isPaid && paidContent.trim() && paidPrice
              ? {
                  paidContent: {
                    content: paidContent,
                    price: parseFloat(paidPrice),
                  },
                }
              : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "保存失败");
        }

        router.push("/admin/posts");
        router.refresh();
      } catch (e: any) {
        setError(e.message || "保存失败");
      }
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/posts"
            className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--accent)]"
            style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            返回列表
          </Link>
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: '"Syne", "Noto Serif SC", sans-serif', color: "var(--text)" }}
          >
            {mode === "create" ? "新建文章" : "编辑文章"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave("DRAFT")}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:border-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", fontFamily: '"JetBrains Mono", monospace' }}
          >
            <Save size={13} aria-hidden="true" />
            保存草稿
          </button>
          <button
            type="button"
            onClick={() => handleSave(isPaid ? "PAID_ONLY" : "PUBLISHED")}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{ background: "var(--accent)", color: "var(--bg)", fontFamily: '"JetBrains Mono", monospace', opacity: isPending ? 0.7 : 1 }}
          >
            <Send size={13} aria-hidden="true" />
            发布
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "rgba(232, 99, 122, 0.1)", border: "1px solid var(--rose)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* Main editor */}
        <div className="flex flex-col gap-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题"
            className="w-full px-4 py-3 rounded-lg text-lg font-bold outline-none transition-colors"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"Syne", "Noto Serif SC", sans-serif' }}
          />

          {/* Slug */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>/post/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
              placeholder="url-slug"
              className="flex-1 px-3 py-1.5 rounded-md text-xs outline-none"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
            />
          </div>

          {/* Excerpt */}
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="文章摘要（可选）"
            rows={2}
            className="w-full px-4 py-2 rounded-lg text-sm outline-none resize-none"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}
          />

          {/* Markdown editor */}
          <div data-color-mode="dark">
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || "")}
              height={500}
              preview="live"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Cover image */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
              封面图 URL
            </label>
            <input
              type="url"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-1.5 rounded-md text-xs outline-none"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
              分类
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md text-xs outline-none"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
            >
              <option value="">无分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
              标签
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setSelectedTagIds((prev) =>
                        selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                      );
                    }}
                    className="px-2 py-1 rounded text-[10px] border transition-colors"
                    style={{
                      borderColor: selected ? "var(--accent)" : "var(--border)",
                      background: selected ? "var(--accent-dim)" : "transparent",
                      color: selected ? "var(--accent)" : "var(--text-muted)",
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)", fontFamily: '"JetBrains Mono", monospace' }}>
              <input
                type="checkbox"
                checked={isTop}
                onChange={(e) => setIsTop(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              置顶文章
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)", fontFamily: '"JetBrains Mono", monospace' }}>
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              付费内容
            </label>
          </div>

          {/* Paid content fields */}
          {isPaid && (
            <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)" }}>
              <label className="text-xs" style={{ color: "var(--accent)", fontFamily: '"JetBrains Mono", monospace' }}>
                价格 (元)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={paidPrice}
                onChange={(e) => setPaidPrice(e.target.value)}
                placeholder="9.90"
                className="w-full px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}
              />
              <label className="text-xs mt-1" style={{ color: "var(--accent)", fontFamily: '"JetBrains Mono", monospace' }}>
                付费内容 (Markdown)
              </label>
              <textarea
                value={paidContent}
                onChange={(e) => setPaidContent(e.target.value)}
                placeholder="付费章节内容..."
                rows={6}
                className="w-full px-2 py-1.5 rounded text-xs outline-none resize-none"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
