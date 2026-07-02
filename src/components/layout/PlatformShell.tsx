"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Bookmark,
  CalendarDays,
  Github,
  Home,
  KeyRound,
  LayoutDashboard,
  Mail,
  Menu,
  PenLine,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import { BlogCard } from "@/components/blog/BlogCard";
import { ArticleOverlay } from "@/components/blog/ArticleOverlay";
import { ProductCard } from "@/components/shop/ProductCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { TypingEffect } from "@/components/ui/TypingEffect";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { favorites, products, stats, timeline } from "@/data/mock";
import { siteConfig } from "@/config/site";
import type { BlogCategory, BlogPost, FavoriteCategory, Product, ProductCategory } from "@/types";

type Section = "home" | "blog" | "shop" | "daily" | "favorites";

type ApiPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  viewCount: number;
  isTop: boolean;
  premium: boolean;
  author: { username: string; nickname: string | null };
  category: { name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string; color: string | null }>;
};

const sections: Array<{ id: Section; label: string; icon: typeof Home; badge?: string }> = [
  { id: "home", label: "首页", icon: Home },
  { id: "blog", label: "技术博客", icon: PenLine },
  { id: "shop", label: "会员与卡密", icon: KeyRound, badge: String(products.length) },
  { id: "daily", label: "日常记录", icon: CalendarDays },
  { id: "favorites", label: "收藏夹", icon: Bookmark }
];

const productFilters: Array<{ id: ProductCategory; label: string }> = [
  { id: "all", label: "全部" },
  { id: "membership", label: "会员" },
  { id: "paid-post", label: "付费文章" },
  { id: "card", label: "卡密" },
  { id: "service", label: "服务" }
];

export function PlatformShell() {
  const { data: session } = useSession();
  const [section, setSection] = useState<Section>("home");
  const [productCategory, setProductCategory] = useState<ProductCategory>("all");
  const [favCategory, setFavCategory] = useState<FavoriteCategory | "all">("all");
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Real blog data
  const [apiPosts, setApiPosts] = useState<ApiPost[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string; postCount: number }>>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");

  useEffect(() => {
    // Load categories
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ pageSize: "20" });
    if (activeCategory) {
      const cat = categories.find((c) => c.slug === activeCategory);
      if (cat) params.set("categoryId", cat.id);
    }
    fetch(`/api/posts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setApiPosts(d.data || []);
        setBlogTotal(d.pagination?.total || 0);
      })
      .catch(() => {});
  }, [activeCategory, categories]);

  const filteredProducts = useMemo(
    () => products.filter((product) => productCategory === "all" || product.category === productCategory),
    [productCategory]
  );

  const filteredFavorites = useMemo(
    () => favorites.filter((fav) => favCategory === "all" || fav.category === favCategory),
    [favCategory]
  );

  const favFilters: Array<{ id: FavoriteCategory | "all"; label: string }> = [
    { id: "all", label: "全部" },
    { id: "post", label: "文章" },
    { id: "tool", label: "工具" },
    { id: "resource", label: "资源" },
    { id: "link", label: "链接" }
  ];

  const moodStyles: Record<string, { bg: string; color: string; label: string }> = {
    happy: { bg: "rgba(250,204,21,0.08)", color: "#CA8A04", label: "☺ 开心" },
    productive: { bg: "var(--teal-dim)", color: "var(--teal)", label: "💻 高产" },
    tired: { bg: "var(--rose-dim)", color: "var(--rose)", label: "😴 疲惫" },
    excited: { bg: "var(--blue-dim)", color: "var(--blue)", label: "⚡ 兴奋" },
    chill: { bg: "rgba(168,130,255,0.08)", color: "#7C3AED", label: "🎧 专注" }
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const selectSection = (nextSection: Section) => {
    setSection(nextSection);
    setMobileOpen(false);
  };

  return (
    <>
      <header className="mobile-header">
        <span className="mobile-logo">
          Cloud<span>Mantou</span>
        </span>
        <div className="flex items-center gap-2">
          <SearchDialog />
          <button
            className="icon-button"
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="打开导航"
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <div
        className={clsx("sidebar-overlay", mobileOpen && "show")}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className="layout">
        <aside className={clsx("sidebar", mobileOpen && "open")}>
          <div className="avatar-wrap" aria-hidden="true">
            <span className="avatar-ring" />
            <span className="avatar">CM</span>
          </div>
          <div className="sidebar-name">{siteConfig.name}</div>
          <div className="sidebar-tag">
            <span className="pulse-dot" />
            在线 · 会员平台
          </div>

          <div className="mb-4">
            <SearchDialog />
          </div>

          <nav className="side-nav" aria-label="主导航">
            <div className="nav-section-label">Navigation</div>
            {sections.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={clsx("nav-item", section === item.id && "active")}
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </button>
              );
            })}

            <div className="nav-section-label">Workspace</div>
            <Link className="nav-item nav-link" href="/dashboard">
              <LayoutDashboard size={16} aria-hidden="true" />
              <span>会员中心</span>
            </Link>
            <Link className="nav-item nav-link" href="/admin">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>后台管理</span>
            </Link>
            <button className="nav-item" type="button" onClick={() => showToast("在线工具将在后台模块接入")}>
              <Settings size={16} aria-hidden="true" />
              <span>在线工具</span>
            </button>
          </nav>

          <div className="social-row">
            <a className="social-link" href="https://github.com" aria-label="GitHub">
              <Github size={15} />
            </a>
            <a className="social-link" href="mailto:hello@example.com" aria-label="Email">
              <Mail size={15} />
            </a>
            <a className="social-link" href="https://t.me" aria-label="Telegram">
              <Send size={15} />
            </a>
          </div>

          {session ? (
            <div className="sidebar-user">
              <div className="sidebar-user-info">
                <span className="sidebar-user-avatar">
                  {(session.user?.nickname || session.user?.username || "U").slice(0, 1).toUpperCase()}
                </span>
                <div className="sidebar-user-meta">
                  <span className="sidebar-user-name">{session.user?.nickname || session.user?.username}</span>
                  <span className="sidebar-user-role">{session.user?.role === "ADMIN" ? "管理员" : "会员"}</span>
                </div>
              </div>
              <button
                className="sidebar-logout"
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                退出
              </button>
            </div>
          ) : (
            <div className="sidebar-user">
              <Link href="/login" className="sidebar-login-btn">
                登录 / 注册
              </Link>
            </div>
          )}
        </aside>

        <main className="main">
          {section === "home" ? (
            <section className="page active home-hero" aria-labelledby="home-title">
              <div className="home-greeting" aria-hidden="true">
                <span className="greeting-diamond" /> CLOUDMANTOU · BLOG &amp; MEMBERSHIP
              </div>
              <h1 className="home-title" id="home-title">
                个人技术博客，
                <br />
                也卖一点<span>会员内容</span>。
              </h1>
              <p className="home-sub">
                <TypingEffect
                  phrases={[
                    "记录开发、运维、独立产品和自动发卡系统的真实实践。",
                    "公开文章免费阅读 · 深度内容支持会员或卡密解锁。",
                    "Next.js 15 · Prisma · MySQL · NextAuth · Docker",
                    "分享技术，记录运营，创造价值。",
                  ]}
                />
              </p>

              {/* Quick actions */}
              <div className="quick-actions">
                <button
                  type="button"
                  onClick={() => selectSection("blog")}
                  className="quick-btn primary"
                >
                  阅读最新文章
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
                <Link href="/dashboard" className="quick-btn ghost">
                  <KeyRound size={15} aria-hidden="true" />
                  兑换卡密
                </Link>
                <button
                  type="button"
                  onClick={() => selectSection("shop")}
                  className="quick-btn ghost"
                >
                  <Sparkles size={15} aria-hidden="true" />
                  查看会员内容
                </button>
              </div>

              <div className="metrics-grid">
                {stats.map((metric, index) => (
                  <MetricCard index={index} key={metric.label} metric={metric} />
                ))}
              </div>

              {/* About + Tech stack */}
              <section className="section-block">
                <h2 className="section-title">关于平台</h2>
                <p className="about-text">
                  CloudMantou 是一套面向独立开发者的内容变现工具：把博客、会员付费、卡密自动交付和运营后台整合在同一个 Next.js 应用里。
                  公开文章免费阅读并做好 SEO，深度内容通过会员订阅或单篇卡密解锁，支付回调、库存锁定和发卡补偿链路分层设计，保证交付可靠。
                </p>
              </section>

              <section className="section-block">
                <h2 className="section-title">技术栈</h2>
                <div className="tech-grid">
                  <span className="tech-pill hot">Next.js 15</span>
                  <span className="tech-pill hot">React 18</span>
                  <span className="tech-pill">TypeScript</span>
                  <span className="tech-pill hot">Prisma</span>
                  <span className="tech-pill">MySQL 8</span>
                  <span className="tech-pill">NextAuth v5</span>
                  <span className="tech-pill">Vitest</span>
                  <span className="tech-pill">Docker</span>
                  <span className="tech-pill">Redis</span>
                  <span className="tech-pill">Tailwind 思路</span>
                  <span className="tech-pill">Markdown</span>
                  <span className="tech-pill">Zod</span>
                </div>
              </section>

              {/* Latest articles preview */}
              {apiPosts.length > 0 && (
                <section className="section-block mt-8">
                  <h2 className="section-title">最新文章</h2>
                  <div className="flex flex-col gap-3">
                    {apiPosts.slice(0, 3).map((post, i) => (
                      <Link
                        key={post.id}
                        href={`/post/${post.slug}`}
                        className="flex items-center justify-between p-4 rounded-lg border transition-all hover:border-[var(--accent)] hover:translate-y-[-2px]"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--card)",
                          textDecoration: "none",
                          animationDelay: `${i * 80}ms`,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {post.premium && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: '"JetBrains Mono", monospace' }}
                              >
                                会员
                              </span>
                            )}
                            <span className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                              {post.title}
                            </span>
                          </div>
                          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                            {post.excerpt || ""}
                          </div>
                        </div>
                        <div className="text-[10px] ml-4 flex-shrink-0" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                          {post.category?.name || ""}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </section>
          ) : null}

          {section === "blog" ? (
            <section className="page active" aria-labelledby="blog-title">
              <div className="page-head">
                <h2 className="page-title" id="blog-title">
                  技术博客
                </h2>
                <p className="page-desc">公开文章、会员文章和单篇付费内容共用同一套内容模型。</p>
              </div>
              <div className="filters" aria-label="文章分类">
                <button
                  className={clsx("filter-button", !activeCategory && "active")}
                  type="button"
                  onClick={() => setActiveCategory("")}
                >
                  全部
                </button>
                {categories.map((cat) => (
                  <button
                    className={clsx("filter-button", activeCategory === cat.slug && "active")}
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.slug)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="blog-list">
                {apiPosts.length === 0 ? (
                  <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>
                    暂无文章
                  </div>
                ) : (
                  apiPosts.map((post, index) => {
                    // Convert API post to BlogPost format for BlogCard
                    const accentColors = ["gold", "teal", "rose", "blue", "orange"] as const;
                    const blogPost: BlogPost = {
                      id: post.id,
                      category: (post.category?.slug || "frontend") as BlogPost["category"],
                      title: post.title,
                      excerpt: post.excerpt || "",
                      date: post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString("zh-CN")
                        : "",
                      readTime: `${Math.max(1, Math.ceil((post.excerpt?.length || 200) / 500))} min`,
                      tags: post.tags.map((t, i) => ({
                        label: t.name,
                        accent: accentColors[i % accentColors.length],
                      })),
                      cover: post.coverImage
                        ? `url('${post.coverImage}')`
                        : "linear-gradient(135deg, rgba(232,185,100,0.22), rgba(77,217,182,0.16))",
                      icon: post.title.slice(0, 2).toUpperCase(),
                      premium: false,
                      content: "",
                      slug: post.slug,
                    };
                    return (
                      <Link key={post.id} href={`/post/${post.slug}`} style={{ textDecoration: "none" }}>
                        <BlogCard index={index} post={blogPost} onOpen={() => {}} />
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}

          {section === "shop" ? (
            <section className="page active" aria-labelledby="shop-title">
              <div className="page-head">
                <h2 className="page-title" id="shop-title">
                  会员与卡密
                </h2>
                <p className="page-desc">会员套餐、付费文章兑换券和批量卡密以后会接入真实订单。</p>
              </div>
              <div className="filters" aria-label="商品分类">
                {productFilters.map((filter) => (
                  <button
                    className={clsx("filter-button", productCategory === filter.id && "active")}
                    key={filter.id}
                    type="button"
                    onClick={() => setProductCategory(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="product-grid">
                {filteredProducts.map((product, index) => (
                  <ProductCard
                    index={index}
                    key={product.id}
                    product={product}
                    onBuy={(item: Product) => showToast(`${item.name} 已加入模拟订单`)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {section === "daily" ? (
            <section className="page active" aria-labelledby="daily-title">
              <div className="page-head">
                <h2 className="page-title" id="daily-title">
                  日常记录
                </h2>
                <p className="page-desc">{"// 生活不止代码，还有诗和远方"}</p>
              </div>
              <div className="daily-timeline">
                {timeline.map((item, index) => {
                  const mood = moodStyles[item.mood] || moodStyles.chill;
                  return (
                    <article
                      className="daily-item fade-up"
                      key={item.id}
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <span className="daily-date">{item.date}</span>
                      <div className="daily-card">
                        <span
                          className="daily-mood"
                          style={{ background: mood.bg, color: mood.color }}
                        >
                          {item.moodLabel}
                        </span>
                        <p className="daily-text">{item.text}</p>

                        {item.photos && item.photos.length > 0 && (
                          <div
                            className={clsx(
                              "daily-photos",
                              item.photos.length <= 2 ? "cols-2" : "cols-3"
                            )}
                          >
                            {item.photos.map((photo) => (
                              <div
                                className={clsx("daily-photo", photo.span === "wide" && "wide", photo.span === "tall" && "tall")}
                                key={photo.label}
                              >
                                <div
                                  className="daily-photo-bg"
                                  style={{ background: photo.gradient }}
                                >
                                  <span className="text-2xl">{photo.icon}</span>
                                </div>
                                <div className="daily-photo-overlay">{photo.label}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="daily-actions">
                          <button
                            className="daily-action"
                            type="button"
                            onClick={(e) => {
                              const btn = e.currentTarget;
                              btn.innerHTML = `❤️ ${(item.likes || 0) + 1}`;
                              btn.style.color = "var(--rose)";
                            }}
                          >
                            🤍 {item.likes || 0}
                          </button>
                          <span className="daily-action">💬 {item.comments || 0}</span>
                          <button
                            className="daily-action"
                            type="button"
                            onClick={() => showToast("链接已复制")}
                          >
                            ↗ 分享
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {section === "favorites" ? (
            <section className="page active" aria-labelledby="fav-title">
              <div className="page-head">
                <h2 className="page-title" id="fav-title">
                  收藏夹
                </h2>
                <p className="page-desc">{"// 收藏的文章、工具和资源"}</p>
              </div>
              <div className="filters" aria-label="收藏分类">
                {favFilters.map((filter) => (
                  <button
                    className={clsx("filter-button", favCategory === filter.id && "active")}
                    key={filter.id}
                    type="button"
                    onClick={() => setFavCategory(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="fav-grid">
                {filteredFavorites.map((fav, index) => (
                  <article
                    className="fav-card fade-up"
                    key={fav.id}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className={clsx("fav-icon", `accent-${fav.accent}`)}>
                      {fav.icon}
                    </div>
                    <div className="fav-body">
                      <div className="fav-title">{fav.title}</div>
                      <div className="fav-desc">{fav.description}</div>
                      {fav.tags && fav.tags.length > 0 && (
                        <div className="fav-tags">
                          {fav.tags.map((tag) => (
                            <span className="fav-tag" key={tag}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="fav-date">{fav.savedAt}</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="移动端导航">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={clsx("bottom-nav-item", section === item.id && "active")}
              key={item.id}
              type="button"
              onClick={() => selectSection(item.id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <ArticleOverlay post={selectedPost} onClose={() => setSelectedPost(null)} />

      <div className={clsx("toast", toast && "show")} role="status" aria-live="polite">
        <Sparkles size={14} aria-hidden="true" />
        {toast}
      </div>
    </>
  );
}
