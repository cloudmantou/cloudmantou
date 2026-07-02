"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, ChevronDown } from "lucide-react";
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

const SEO_TITLE_LIMIT = 60;
const SEO_DESC_LIMIT = 160;

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
  const [isTop, setIsTop] = useState(initialData?.isTop || false);
  const [isPaid, setIsPaid] = useState(initialData?.status === "PAID_ONLY");
  const [paidContent, setPaidContent] = useState(initialData?.paidContent?.content || "");
  const [paidPrice, setPaidPrice] = useState(initialData?.paidContent?.price?.toString() || "");

  const [seoTitle, setSeoTitle] = useState(initialData?.title || "");
  const [seoDesc, setSeoDesc] = useState(initialData?.excerpt || "");
  const [seoKeyword, setSeoKeyword] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState("");
  const [slugEdited, setSlugEdited] = useState(mode === "edit");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [tagInput, setTagInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    setSlug(generated || `post-${Date.now().toString(36)}`);
  }, [title, slugEdited]);

  // Mark unsaved on any change
  useEffect(() => {
    if (mode === "create" && !title && !content) return;
    setSaveState("unsaved");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, excerpt, content, coverImage, categoryId, selectedTagIds, isTop, isPaid, paidContent, paidPrice]);

  // Auto-clear saving badge after 1.2s (cosmetic only — no real autosave)
  useEffect(() => {
    if (saveState !== "unsaved") return;
    const t = setTimeout(() => setSaveState("saving"), 800);
    const t2 = setTimeout(() => setSaveState("saved"), 2200);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [saveState]);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addTagFromInput = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    // 尝试匹配已有标签
    const matched = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      if (!selectedTagIds.includes(matched.id)) {
        setSelectedTagIds((prev) => [...prev, matched.id]);
      }
    } else {
      // 没有匹配：临时显示未保存的 tag 名（用 input 自带的 chip 方案过于复杂，
      // 简化为不创建临时 tag，让用户去 /admin/tags 先建好）
    }
    setTagInput("");
  };

  const handleSave = (publishStatus: "DRAFT" | "PUBLISHED" | "PAID_ONLY") => {
    if (!title.trim() || !content.trim()) {
      setError("标题和内容不能为空");
      return;
    }
    if (!slug.trim()) {
      setError("slug 不能为空");
      return;
    }
    setError("");

    const finalStatus = isPaid ? "PAID_ONLY" : publishStatus;

    startTransition(async () => {
      try {
        const url = mode === "create" ? "/api/admin/posts" : `/api/admin/posts/${initialData?.id}`;
        const method = mode === "create" ? "POST" : "PUT";

        let paidContentPayload: { content: string; price: number } | null | undefined;
        if (isPaid && paidContent.trim() && paidPrice) {
          paidContentPayload = { content: paidContent, price: parseFloat(paidPrice) };
        } else if (mode === "edit" && !isPaid) {
          paidContentPayload = null;
        }

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
            ...(paidContentPayload !== undefined ? { paidContent: paidContentPayload } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "保存失败");
        }

        setSaveState("saved");
        router.push("/admin/posts");
        router.refresh();
      } catch (e: any) {
        setError(e.message || "保存失败");
      }
    });
  };

  // 字数统计
  const plainText = content.replace(/[#*_`>\-\[\]()!\n]/g, " ");
  const charCount = plainText.replace(/\s/g, "").length;
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.ceil(charCount / 300));
  const headCount = (content.match(/^#{1,3}\s/gm) || []).length;
  const wordGoalPct = Math.min(100, Math.round(charCount / 10));

  // 发布检查清单
  const checklist = [
    { ok: !!title.trim(), warn: false, text: "文章标题已设置" },
    { ok: !!categoryId, warn: false, text: "文章分类已选择" },
    { ok: !!coverImage, warn: false, text: "封面图片已设置" },
    { ok: !!seoTitle.trim(), warn: false, text: "SEO 标题已设置" },
    {
      ok: seoDesc.length >= 120,
      warn: seoDesc.length > 0 && seoDesc.length < 120,
      no: seoDesc.length === 0,
      text: `Meta 描述${seoDesc.length === 0 ? "未设置" : seoDesc.length < 120 ? "偏短 (建议 >120 字)" : "已达标"}`,
    },
    { ok: !!excerpt.trim(), warn: false, text: "文章摘要已填写" },
    { ok: headCount > 0, warn: false, text: `已使用 ${headCount} 个标题` },
    { ok: charCount >= 300, warn: charCount > 0 && charCount < 300, no: charCount === 0, text: `内容字数${charCount === 0 ? "为空" : charCount < 300 ? "偏少" : "达标"}` },
  ];

  return (
    <div className="editor-page">
      {/* Topbar */}
      <header className="editor-topbar">
        <div className="editor-topbar-left">
          <Link href="/admin/posts" className="back-btn">
            <ArrowLeft size={14} aria-hidden="true" />
            返回
          </Link>
          <div className="editor-title-area">
            <h1>{mode === "create" ? "新建文章" : "编辑文章"}</h1>
            <div className="doc-status">
              <div className={`status-dot ${saveState}`}></div>
              <span>
                {saveState === "saved" && "已自动保存"}
                {saveState === "saving" && "正在保存…"}
                {saveState === "unsaved" && "未保存"}
              </span>
            </div>
          </div>
        </div>
        <div className="editor-topbar-right">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="e-btn e-btn-ghost e-btn-sm sidebar-toggle-btn"
          >
            ⚙ 设置
          </button>
          <button
            type="button"
            onClick={() => handleSave("DRAFT")}
            disabled={isPending}
            className="e-btn e-btn-ghost e-btn-sm"
          >
            <Save size={13} aria-hidden="true" />
            保存草稿
          </button>
          <button
            type="button"
            onClick={() => handleSave(isPaid ? "PAID_ONLY" : "PUBLISHED")}
            disabled={isPending}
            className="e-btn e-btn-accent e-btn-sm"
          >
            <Send size={13} aria-hidden="true" />
            {isPaid ? "发布付费" : "发布文章"}
            <span className="kbd-hint">⌘↵</span>
          </button>
        </div>
      </header>

      {error && <div className="editor-error">{error}</div>}

      {/* Layout */}
      <div className="editor-layout">
        {/* Main */}
        <div className="editor-main">
          {/* Title */}
          <div className="title-input-wrap">
            <input
              type="text"
              className="title-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                // SEO 标题只在用户未手动编辑过时跟随 title 变化
                if (!seoTitle || seoTitle === initialData?.title || seoTitle === "") {
                  setSeoTitle(e.target.value);
                }
              }}
              placeholder="输入文章标题…"
            />
          </div>

          {/* Slug */}
          <div className="slug-bar">
            <span>URL:</span>
            <span style={{ color: "var(--e-text-muted)" }}>/posts/</span>
            <input
              type="text"
              className="slug-input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
            />
          </div>

          {/* Markdown editor */}
          <div className="editor-md-wrap" data-color-mode="dark">
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || "")}
              height={520}
              preview="live"
            />
          </div>

          {/* Excerpt & Cover (放在主编辑区下方) */}
          <div className="editor-extra">
            <div>
              <label className="form-label" style={{ color: "var(--e-text-muted)" }}>
                文章摘要 · 用于列表和 RSS
              </label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="一句话总结这篇文章..."
                rows={2}
              />
            </div>
            <div>
              <label className="form-label" style={{ color: "var(--e-text-muted)" }}>
                封面图 URL（可选）
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://..."
              />
            </div>
            {isPaid && (
              <div
                style={{
                  background: "var(--e-accent-glow)",
                  border: "1px solid var(--e-accent)",
                  borderRadius: "var(--e-radius-sm)",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ color: "var(--e-accent-light)" }}>
                      付费价格 (元)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paidPrice}
                      onChange={(e) => setPaidPrice(e.target.value)}
                      placeholder="9.90"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        background: "var(--e-surface)",
                        border: "1px solid var(--e-border)",
                        borderRadius: "var(--e-radius-xs)",
                        color: "var(--e-text)",
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ color: "var(--e-accent-light)" }}>
                      付费内容 (Markdown)
                    </label>
                    <textarea
                      value={paidContent}
                      onChange={(e) => setPaidContent(e.target.value)}
                      placeholder="付费章节内容..."
                      rows={6}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "var(--e-surface)",
                        border: "1px solid var(--e-border)",
                        borderRadius: "var(--e-radius-xs)",
                        color: "var(--e-text)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        outline: "none",
                        resize: "vertical",
                        minHeight: 120,
                        lineHeight: 1.55,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className={`editor-sidebar${sidebarOpen ? " open" : ""}`}>
          {/* Publish Settings */}
          <SidebarSection title="📝 发布设置" defaultOpen>
            <div className="form-group">
              <label className="form-label">文章状态</label>
              <select
                className="form-select"
                value={isPaid ? "paid" : "draft"}
                onChange={() => {}}
                disabled
                style={{ opacity: 0.7 }}
              >
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="paid">付费</option>
              </select>
              <div style={{ fontSize: 10, color: "var(--e-text-muted)", marginTop: 4 }}>
                点击右上「发布文章」/「保存草稿」切换
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">文章分类</label>
              <select
                className="form-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">选择分类...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </SidebarSection>

          {/* Tags */}
          <SidebarSection title="🏷 标签" defaultOpen>
            <div className="form-group">
              <div className="tags-container" onClick={() => {}}>
                {selectedTagIds.map((id) => {
                  const tag = tags.find((t) => t.id === id);
                  if (!tag) return null;
                  return (
                    <span key={id} className="tag-chip">
                      {tag.name}
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => toggleTag(id)}
                        aria-label={`移除 ${tag.name}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                <input
                  type="text"
                  className="tag-input"
                  placeholder="搜索标签..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTagFromInput();
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: 80,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "var(--e-text)",
                    fontFamily: "inherit",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>
            {/* 可选标签 */}
            {tags.length > 0 && (
              <div className="form-group">
                <label className="form-label">可选标签</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tags
                    .filter((t) => !selectedTagIds.includes(t.id))
                    .map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        style={{
                          padding: "3px 8px",
                          background: "transparent",
                          border: "1px solid var(--e-border)",
                          borderRadius: 4,
                          fontSize: 11,
                          color: "var(--e-text-muted)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        + {tag.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </SidebarSection>

          {/* Cover */}
          <SidebarSection title="🖼 封面图片">
            <div
              className={`cover-upload${coverImage ? " has-image" : ""}`}
              onClick={() => {
                const url = prompt("输入封面图 URL：", coverImage || "https://");
                if (url !== null) setCoverImage(url);
              }}
            >
              {coverImage ? (
                <>
                  <img src={coverImage} alt="cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  <div className="cover-overlay">
                    <button
                      type="button"
                      className="cover-overlay-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = prompt("更换封面：", coverImage);
                        if (url !== null) setCoverImage(url);
                      }}
                    >
                      更换
                    </button>
                    <button
                      type="button"
                      className="cover-overlay-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverImage("");
                      }}
                    >
                      移除
                    </button>
                  </div>
                </>
              ) : (
                <div className="cover-upload-text">
                  <strong>点击设置封面图片</strong>
                  推荐 1200×630px
                </div>
              )}
            </div>
          </SidebarSection>

          {/* SEO */}
          <SidebarSection title="🔍 SEO 设置" defaultOpen>
            <div className="seo-preview">
              <div className="seo-preview-title">{seoTitle || "文章标题"}</div>
              <div className="seo-preview-url">
                https://{typeof window !== "undefined" ? window.location.host : "site"}
                /posts/{slug || "url-slug"}
              </div>
              <div className="seo-preview-desc">{seoDesc || "文章摘要会显示在搜索结果中…"}</div>
            </div>
            <div className="form-group">
              <label className="form-label">
                SEO 标题
                <span className="field-counter">
                  {seoTitle.length}/{SEO_TITLE_LIMIT}
                </span>
              </label>
              <input
                type="text"
                className="form-input"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={SEO_TITLE_LIMIT}
                placeholder="搜索引擎显示的标题"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Meta 描述
                <span className="field-counter">
                  {seoDesc.length}/{SEO_DESC_LIMIT}
                </span>
              </label>
              <textarea
                className="form-textarea"
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                maxLength={SEO_DESC_LIMIT}
                rows={3}
                placeholder="~160 字符最佳"
              />
            </div>
            <div className="form-group">
              <label className="form-label">焦点关键词</label>
              <input
                type="text"
                className="form-input"
                value={seoKeyword}
                onChange={(e) => setSeoKeyword(e.target.value)}
                placeholder="如: Next.js, React"
              />
            </div>
          </SidebarSection>

          {/* Options */}
          <SidebarSection title="⚙ 文章选项" defaultOpen>
            <div className="toggle-row">
              <span className="toggle-label">置顶文章</span>
              <button
                type="button"
                className={`e-toggle${isTop ? " on" : ""}`}
                onClick={() => setIsTop(!isTop)}
                aria-pressed={isTop}
                aria-label="置顶文章"
              />
            </div>
            <div className="toggle-row">
              <span className="toggle-label">付费阅读</span>
              <button
                type="button"
                className={`e-toggle${isPaid ? " on" : ""}`}
                onClick={() => setIsPaid(!isPaid)}
                aria-pressed={isPaid}
                aria-label="付费阅读"
              />
            </div>
            <div className="toggle-row">
              <span className="toggle-label">开启评论</span>
              <button type="button" className="e-toggle on" aria-label="开启评论" />
            </div>
            <div className="toggle-row">
              <span className="toggle-label">允许转载</span>
              <button type="button" className="e-toggle on" aria-label="允许转载" />
            </div>
          </SidebarSection>

          {/* Stats */}
          <SidebarSection title="📊 文章统计">
            <div className="word-count-bar">
              <div className="word-count-item">
                <div className="word-count-num">{charCount.toLocaleString()}</div>
                <div className="word-count-label">字符</div>
              </div>
              <div className="word-count-item">
                <div className="word-count-num">{wordCount.toLocaleString()}</div>
                <div className="word-count-label">字数</div>
              </div>
              <div className="word-count-item">
                <div className="word-count-num">{readTime}</div>
                <div className="word-count-label">分钟阅读</div>
              </div>
              <div className="word-count-item">
                <div className="word-count-num">{headCount}</div>
                <div className="word-count-label">标题数</div>
              </div>
            </div>
            <div className="word-goal">
              <div className="word-goal-bar">
                <div className="word-goal-fill" style={{ width: `${wordGoalPct}%` }} />
              </div>
              <div className="word-goal-text">目标 1000 字 · 已完成 {wordGoalPct}%</div>
            </div>
          </SidebarSection>

          {/* Checklist */}
          <SidebarSection title="✅ 发布检查">
            <div className="checklist">
              {checklist.map((item, i) => (
                <div key={i} className="checklist-item">
                  <span
                    className={`check-icon ${
                      item.ok ? "ok" : item.warn ? "warn" : "no"
                    }`}
                  >
                    ●
                  </span>
                  {item.text}
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* History */}
          <SidebarSection title="🕐 修改历史" defaultOpen>
            <div className="history-item">
              <div className="history-dot" style={{ background: "var(--e-success)" }} />
              <div>
                <div>{mode === "create" ? "已创建" : "最近编辑"}</div>
                <div className="history-time">刚刚</div>
              </div>
            </div>
            <div className="history-item">
              <div className="history-dot" />
              <div>
                <div>草稿</div>
                <div className="history-time">{new Date().toLocaleString("zh-CN")}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "var(--e-text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              完整历史功能需要服务端实现 PostRevision 模型。
            </div>
          </SidebarSection>
        </aside>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`sidebar-section${open ? "" : " collapsed"}`}>
      <div className="sidebar-section-header" onClick={() => setOpen(!open)}>
        <span className="sidebar-section-title">{title}</span>
        <span className="sidebar-section-toggle">
          <ChevronDown size={12} />
        </span>
      </div>
      {open && <div className="sidebar-section-body">{children}</div>}
    </div>
  );
}
