"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
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
  X
} from "lucide-react";
import clsx from "clsx";
import { BlogCard } from "@/components/blog/BlogCard";
import { ArticleOverlay } from "@/components/blog/ArticleOverlay";
import { ProductCard } from "@/components/shop/ProductCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { products, stats, timeline } from "@/data/mock";
import { siteConfig } from "@/config/site";
import type { BlogCategory, BlogPost, Product, ProductCategory } from "@/types";

type Section = "home" | "blog" | "shop" | "daily";

type ApiPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  viewCount: number;
  isTop: boolean;
  author: { username: string; nickname: string | null };
  category: { name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string; color: string | null }>;
};

const sections: Array<{ id: Section; label: string; icon: typeof Home; badge?: string }> = [
  { id: "home", label: "首页", icon: Home },
  { id: "blog", label: "技术博客", icon: PenLine },
  { id: "shop", label: "会员与卡密", icon: KeyRound, badge: String(products.length) },
  { id: "daily", label: "运营记录", icon: CalendarDays }
];

const productFilters: Array<{ id: ProductCategory; label: string }> = [
  { id: "all", label: "全部" },
  { id: "membership", label: "会员" },
  { id: "paid-post", label: "付费文章" },
  { id: "card", label: "卡密" },
  { id: "service", label: "服务" }
];

export function PlatformShell() {
  const [section, setSection] = useState<Section>("home");
  const [productCategory, setProductCategory] = useState<ProductCategory>("all");
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
        </aside>

        <main className="main">
          {section === "home" ? (
            <section className="page active" aria-labelledby="home-title">
              <div className="home-greeting">CloudMantou Membership Studio</div>
              <h1 className="home-title" id="home-title">
                博客、会员内容与<span>自动发卡</span>
                <br />
                合在一个运营系统里
              </h1>
              <p className="home-sub">
                Next.js App Router · MySQL/Prisma · 支付回调 · 卡密库存 · 后台运营
              </p>

              <div className="metrics-grid">
                {stats.map((metric, index) => (
                  <MetricCard index={index} key={metric.label} metric={metric} />
                ))}
              </div>

              <section className="section-block" aria-labelledby="platform-focus">
                <h2 className="section-title" id="platform-focus">
                  项目定位
                </h2>
                <p className="about-text">
                  CloudMantou 不是单独的商城，也不是只有文章列表的博客。它把公开内容、会员专栏、单篇付费、卡密兑换和站长后台放在一套订单与权限模型里，适合个人知识产品长期运营。
                </p>
              </section>

              <section className="section-block" aria-labelledby="stack-title">
                <h2 className="section-title" id="stack-title">
                  技术栈
                </h2>
                <div className="tech-grid">
                  {["Next.js 15", "TypeScript", "React Server Components", "Prisma", "MySQL", "Zod", "Redis", "Docker"].map(
                    (item, index) => (
                      <span className={clsx("tech-pill", index < 3 && "hot")} key={item}>
                        {item}
                      </span>
                    )
                  )}
                </div>
              </section>
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
                  <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}>
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
                      content: [],
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
                  运营记录
                </h2>
                <p className="page-desc">把开发阶段、支付上线和后台运营拆成可追踪节点。</p>
              </div>
              <div className="timeline">
                {timeline.map((item, index) => (
                  <article className="timeline-item fade-up" key={item.id} style={{ animationDelay: `${index * 80}ms` }}>
                    <span className="timeline-date">{item.date}</span>
                    <div className="timeline-card">
                      <span className={clsx("mood", `accent-${item.accent}`)}>{item.mood}</span>
                      <p>{item.text}</p>
                    </div>
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
