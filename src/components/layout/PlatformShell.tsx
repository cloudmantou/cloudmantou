"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Bookmark,
  CalendarDays,
  Github,
  Home,
  KeyRound,
  LogIn,
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
import { DailyCommentSection } from "@/components/daily/DailyCommentSection";
import { favorites, products, stats, timeline } from "@/data/mock";
import { siteConfig } from "@/config/site";
import { isAdminRole } from "@/lib/roles";
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
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = isAdminRole(session?.user?.role);
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

  // Daily records data
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [dailyContent, setDailyContent] = useState("");
  const [dailyMood, setDailyMood] = useState("");
  const [dailyWeather, setDailyWeather] = useState("");
  const [dailyLocation, setDailyLocation] = useState("");
  const [dailyPublishing, setDailyPublishing] = useState(false);
  const [dailyPhotos, setDailyPhotos] = useState<string[]>([]);
  const [dailyTags, setDailyTags] = useState<string[]>([]);
  const [dailyTagInput, setDailyTagInput] = useState("");
  const [dailyVisibility, setDailyVisibility] = useState<"public" | "link" | "private" | "friends">("public");


  const moodOptions = ["😊", "😌", "🤔", "😴", "🔥", "🎉", "😤", "☕"];
  const weatherOptions = ["☀️", "⛅", "🌧️", "❄️", "🌙"];
  const visibilityOptions = [
    { id: "public" as const, label: "🌐 所有人可见" },
    { id: "friends" as const, label: "👥 仅好友" },
    { id: "link" as const, label: "🔗 链接可见" },
    { id: "private" as const, label: "🔒 仅自己" },
  ];

  const openPostOverlay = (post: ApiPost) => {
    const accentColors = ["gold", "teal", "rose", "blue", "orange"] as const;
    const blogPost: BlogPost = {
      id: post.id,
      category: (post.category?.slug || "frontend") as BlogPost["category"],
      categoryName: post.category?.name,
      title: post.title,
      excerpt: post.excerpt || "",
      date: post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("zh-CN") : "",
      readTime: `${Math.max(1, Math.ceil((post.excerpt?.length || 200) / 500))} min`,
      tags: post.tags.map((t, i) => ({
        label: t.name,
        accent: accentColors[i % accentColors.length],
      })),
      cover: post.coverImage
        ? `url('${post.coverImage}')`
        : "linear-gradient(135deg, rgba(232,185,100,0.22), rgba(77,217,182,0.16))",
      icon: post.title.slice(0, 2).toUpperCase(),
      premium: post.premium,
      content: "",
      slug: post.slug,
    };
    setSelectedPost(blogPost);
  };

  const cycleVisibility = () => {
    const idx = visibilityOptions.findIndex((v) => v.id === dailyVisibility);
    setDailyVisibility(visibilityOptions[(idx + 1) % visibilityOptions.length].id);
  };

  const handlePhotoUpload = (files: FileList | null) => {
    if (!files) return;
    const remaining = 9 - dailyPhotos.length;
    Array.from(files)
      .slice(0, remaining)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setDailyPhotos((prev) => (prev.length < 9 ? [...prev, reader.result as string] : prev));
          }
        };
        reader.readAsDataURL(file);
      });
  };

  const addDailyTag = () => {
    const tag = dailyTagInput.trim().replace(/^#/, "");
    if (!tag || dailyTags.includes(tag) || dailyTags.length >= 10) return;
    setDailyTags((prev) => [...prev, tag]);
    setDailyTagInput("");
  };

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

  // Load daily records
  useEffect(() => {
    if (section !== "daily") return;
    fetch("/api/daily-records?pageSize=20")
      .then((r) => r.json())
      .then((d) => {
        setDailyRecords(d.data || []);
        setDailyTotal(d.pagination?.total || 0);
      })
      .catch(() => {});
  }, [section]);

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

  const handleBuyProduct = (product: Product) => {
    if (!session) {
      router.push("/login?callbackUrl=/");
      return;
    }
    if (!product.productType) {
      showToast("该商品暂未开放购买");
      return;
    }
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productType: product.productType }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "下单失败");
        showToast(`订单已创建：${data.data.orderNo}`);
      })
      .catch((e: Error) => showToast(e.message || "下单失败"));
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
            {!session ? (
              <Link className="nav-item nav-link" href="/login?callbackUrl=/">
                <LogIn size={16} aria-hidden="true" />
                <span>登录</span>
              </Link>
            ) : null}
            {isAdmin ? (
              <Link className="nav-item nav-link" href="/admin">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>后台管理</span>
              </Link>
            ) : null}
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
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                退出
              </button>
            </div>
          ) : (
            <div className="sidebar-user">
              <Link href="/login?callbackUrl=/" className="sidebar-login-btn">
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
                <button
                  type="button"
                  onClick={() => selectSection("shop")}
                  className="quick-btn ghost"
                >
                  <KeyRound size={15} aria-hidden="true" />
                  购买会员
                </button>
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
                      premium: post.premium,
                      content: "",
                      slug: post.slug,
                      categoryName: post.category?.name,
                    };
                    return (
                      <button
                        key={post.id}
                        type="button"
                        className="blog-card-btn"
                        onClick={() => openPostOverlay(post)}
                      >
                        <BlogCard index={index} post={blogPost} />
                      </button>
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
                <p className="page-desc">登录后可直接下单会员套餐，支付对接完成后自动开通。</p>
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
                    onBuy={handleBuyProduct}
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
                <p className="page-desc">
                  {isAdmin ? "// 管理员可在此发布日常" : "// 浏览动态，登录后可评论"}
                </p>
              </div>

              {!session && (
                <div
                  className="mb-6 p-4 rounded-lg text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  登录后可购买会员、评论文章与日常动态。
                  <Link href="/login?callbackUrl=/" style={{ color: "var(--accent)", marginLeft: 8 }}>
                    去登录 →
                  </Link>
                </div>
              )}

              {/* Composer — 仅管理员 */}
              {session && isAdmin && (
                <div className="daily-composer">
                  <div className="daily-composer-header">
                    <div className="daily-composer-avatar" aria-hidden="true">
                      {(session.user?.nickname || session.user?.username || "U").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="daily-composer-author">
                        {session.user?.nickname || session.user?.username}
                      </div>
                      <button
                        type="button"
                        className="daily-composer-visibility"
                        onClick={cycleVisibility}
                      >
                        {visibilityOptions.find((v) => v.id === dailyVisibility)?.label}
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={dailyContent}
                    onChange={(e) => setDailyContent(e.target.value.slice(0, 2000))}
                    placeholder="这一刻的想法..."
                    rows={4}
                    className="daily-composer-textarea"
                  />

                  <div className="daily-composer-meta">
                    <div className="daily-emoji-group">
                      <span>心情</span>
                      {moodOptions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={clsx("daily-emoji-btn", dailyMood === emoji && "active")}
                          onClick={() => setDailyMood(dailyMood === emoji ? "" : emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="daily-emoji-group">
                      <span>天气</span>
                      {weatherOptions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={clsx("daily-emoji-btn", dailyWeather === emoji && "active")}
                          onClick={() => setDailyWeather(dailyWeather === emoji ? "" : emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="daily-composer-location">
                    <span aria-hidden="true">📍</span>
                    <input
                      type="text"
                      value={dailyLocation}
                      onChange={(e) => setDailyLocation(e.target.value)}
                      placeholder="添加位置（可选）"
                      className="daily-composer-location-input"
                    />
                  </div>

                  {dailyPhotos.length > 0 && (
                    <div className={clsx("daily-photos", dailyPhotos.length <= 2 ? "cols-2" : "cols-3")}>
                      {dailyPhotos.map((photo, i) => (
                        <div className="daily-photo daily-photo-preview" key={i}>
                          <img src={photo} alt="" />
                          <button
                            type="button"
                            className="daily-photo-remove"
                            onClick={() => setDailyPhotos((prev) => prev.filter((_, j) => j !== i))}
                            aria-label="移除图片"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="daily-composer-tags">
                    {dailyTags.map((tag) => (
                      <span key={tag} className="daily-tag-chip">
                        #{tag}
                        <button type="button" onClick={() => setDailyTags((prev) => prev.filter((t) => t !== tag))}>
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={dailyTagInput}
                      onChange={(e) => setDailyTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDailyTag();
                        }
                      }}
                      placeholder="添加标签..."
                      className="daily-tag-input"
                    />
                  </div>

                  <div className="daily-composer-actions">
                    <label className="daily-action-btn">
                      📷 图片
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(e) => handlePhotoUpload(e.target.files)}
                      />
                    </label>
                  </div>

                  <div className="daily-composer-toolbar">
                    <span
                      className={clsx(
                        "daily-char-counter",
                        dailyContent.length > 1800 && "warning",
                        dailyContent.length >= 2000 && "danger"
                      )}
                    >
                      {dailyContent.length} / 2000
                    </span>
                    <button
                      type="button"
                      className="daily-publish-btn"
                      onClick={() => {
                        if (!dailyContent.trim()) return;
                        setDailyPublishing(true);
                        fetch("/api/daily-records", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            content: dailyContent.trim(),
                            photos: dailyPhotos.length > 0 ? dailyPhotos : undefined,
                            mood: dailyMood || undefined,
                            weather: dailyWeather || undefined,
                            location: dailyLocation.trim() || undefined,
                            visibility: dailyVisibility,
                            tagNames: dailyTags.length > 0 ? dailyTags : undefined,
                          }),
                        })
                          .then((r) => {
                            if (r.ok) {
                              setDailyContent("");
                              setDailyMood("");
                              setDailyWeather("");
                              setDailyLocation("");
                              setDailyPhotos([]);
                              setDailyTags([]);
                              setDailyVisibility("public");
                              return fetch("/api/daily-records?pageSize=20").then((r) => r.json());
                            }
                          })
                          .then((d) => {
                            if (d) {
                              setDailyRecords(d.data || []);
                              setDailyTotal(d.pagination?.total || 0);
                            }
                          })
                          .catch(() => {})
                          .finally(() => setDailyPublishing(false));
                      }}
                      disabled={dailyPublishing || !dailyContent.trim()}
                    >
                      发布
                    </button>
                  </div>
                </div>
              )}

              {session && !isAdmin && (
                <div
                  className="mb-6 p-4 rounded-lg text-xs"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
                >
                  日常记录由管理员发布。登录后可在每条动态下方评论。
                </div>
              )}

              <div className="daily-timeline-header">
                <h3 className="daily-timeline-title">
                  时间线 <span className="daily-timeline-count">{dailyTotal} 条记录</span>
                </h3>
              </div>

              <div className="daily-timeline">
                {dailyRecords.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>暂无记录</p>
                ) : dailyRecords.map((item: any, index: number) => (
                    <article
                      className="daily-item fade-up"
                      key={item.id}
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <span className="daily-date">
                        {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                        {item.weather ? ` · ${item.weather}` : ""}
                        {item.location ? ` · 📍 ${item.location}` : ""}
                      </span>
                      <div className="daily-card">
                        <div className="daily-card-header">
                          <div className="daily-card-author">
                            <span className="daily-card-avatar">
                              {(item.author?.nickname || item.author?.username || "U").slice(0, 1).toUpperCase()}
                            </span>
                            <span>{item.author?.nickname || item.author?.username || "用户"}</span>
                          </div>
                          {item.mood && (
                            <span className="daily-mood" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                              {item.mood}
                            </span>
                          )}
                        </div>
                        <p className="daily-text">{item.content}</p>

                        {item.photos && item.photos.length > 0 && (
                          <div className={clsx("daily-photos", item.photos.length <= 2 ? "cols-2" : "cols-3")}>
                            {item.photos.map((photo: string, i: number) => (
                              <div className="daily-photo" key={i}>
                                <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            ))}
                          </div>
                        )}

                        {item.tagNames && item.tagNames.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {item.tagNames.map((t: string) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: '"JetBrains Mono", monospace' }}>
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="daily-actions">
                          <button
                            className="daily-action"
                            type="button"
                            onClick={(e) => {
                              if (!session) {
                                router.push("/login?callbackUrl=/");
                                return;
                              }
                              fetch(`/api/daily-records/${item.id}/like`, { method: "POST" })
                                .then((r) => r.json())
                                .then((d) => {
                                  if (d.data) {
                                    const btn = e.currentTarget;
                                    btn.innerHTML = `❤️ ${d.data.likeCount}`;
                                    btn.style.color = "var(--rose)";
                                  }
                                })
                                .catch(() => {});
                            }}
                          >
                            🤍 {item.likesCount || 0}
                          </button>
                          <DailyCommentSection
                            recordId={item.id}
                            initialCount={item.commentsCount || 0}
                          />
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
                  ))}
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
