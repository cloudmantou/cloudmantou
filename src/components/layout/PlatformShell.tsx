"use client";

import { Suspense, useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bookmark,
  CalendarDays,
  Home,
  KeyRound,
  PenLine,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import {
  PlatformSidebar,
  type PlatformSection,
} from "@/components/layout/PlatformSidebar";
import { BlogCard } from "@/components/blog/BlogCard";
import { ArticleOverlay } from "@/components/blog/ArticleOverlay";

import { ProductCard } from "@/components/shop/ProductCard";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { MetricCard } from "@/components/ui/MetricCard";
import { TypingEffect } from "@/components/ui/TypingEffect";
import { DailyCommentSection } from "@/components/daily/DailyCommentSection";
import { PaymentCheckout, type CheckoutOrder } from "@/components/payment/PaymentCheckout";
import { favorites, stats as mockStats, timeline } from "@/data/mock";
import { DEFAULT_HOME_TYPING_PHRASES } from "@/lib/site-settings";
import type { BlogCategory, BlogPost, FavoriteCategory, Product, ProductCategory } from "@/types";

type Section = PlatformSection;

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
  { id: "shop", label: "会员与卡密", icon: KeyRound },
  { id: "daily", label: "日常记录", icon: CalendarDays },
  { id: "favorites", label: "收藏夹", icon: Bookmark },
];

const VALID_SECTIONS = new Set<Section>(["home", "blog", "shop", "daily", "favorites"]);

const productFilters: Array<{ id: ProductCategory; label: string }> = [
  { id: "all", label: "全部" },
  { id: "membership", label: "会员" },
  { id: "paid-post", label: "付费文章" },
  { id: "card", label: "卡密" },
  { id: "service", label: "服务" }
];

function PlatformShellInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === "authenticated" && Boolean(session?.user);
  const [section, setSection] = useState<Section>("home");
  const [productCategory, setProductCategory] = useState<ProductCategory>("all");
  const [favCategory, setFavCategory] = useState<FavoriteCategory | "all">("all");
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Real blog data
  const [apiPosts, setApiPosts] = useState<ApiPost[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string; postCount: number }>>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");

  // Daily records data
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [checkoutOrder, setCheckoutOrder] = useState<CheckoutOrder | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [typingPhrases, setTypingPhrases] = useState<string[]>(DEFAULT_HOME_TYPING_PHRASES);
  const [homeSubtitle, setHomeSubtitle] = useState("");

  const homeStats = useMemo(
    () => mockStats.filter((item) => item.label !== "会员专栏" && item.label !== "卡密库存"),
    []
  );

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

  useEffect(() => {
    fetch("/api/site/home-content")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.data?.typingPhrases) && d.data.typingPhrases.length > 0) {
          setTypingPhrases(d.data.typingPhrases);
        }
        if (typeof d.data?.siteSubtitle === "string") {
          setHomeSubtitle(d.data.siteSubtitle);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (section !== "blog" && section !== "home") return;
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(() => {});
  }, [section]);

  useEffect(() => {
    if (section !== "blog" && section !== "home") return;
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
  }, [activeCategory, categories, section]);

  useEffect(() => {
    if (section !== "shop" && section !== "home") return;
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.data)) setShopProducts(d.data);
      })
      .catch(() => {});
  }, [section]);

  useEffect(() => {
    const fromUrl = searchParams.get("section");
    if (fromUrl && VALID_SECTIONS.has(fromUrl as Section)) {
      setSection(fromUrl as Section);
    }
  }, [searchParams]);

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
    () =>
      shopProducts.filter(
        (product) => productCategory === "all" || product.category === productCategory
      ),
    [productCategory, shopProducts]
  );

  const publishedCardProducts = useMemo(
    () => shopProducts.filter((product) => product.category === "card"),
    [shopProducts]
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

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setProductDetailOpen(true);
  };

  const handleBuyProduct = (product: Product) => {
    if (sessionStatus === "loading") {
      showToast("正在验证登录状态，请稍候");
      return;
    }
    if (!isLoggedIn) {
      const callback =
        section === "shop" ? "/?section=shop" : section === "home" ? "/" : `/?section=${section}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callback)}`);
      return;
    }
    if (!product.productType) {
      showToast("该商品暂未开放购买");
      return;
    }
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productType: product.productType,
        productId: product.productType === "CARD_PACKAGE" || product.productType === "PAID_POST"
          ? product.id
          : undefined,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "下单失败");
        setCheckoutOrder({
          id: data.data.id,
          orderNo: data.data.orderNo,
          title: data.data.title,
          amount: data.data.amount,
        });
        setCheckoutOpen(true);
      })
      .catch((e: Error) => showToast(e.message || "下单失败"));
  };

  const selectSection = useCallback((nextSection: Section) => {
    setSection(nextSection);
    const url = nextSection === "home" ? "/" : `/?section=${nextSection}`;
    router.replace(url, { scroll: false });
  }, [router]);

  return (
    <>
      <PlatformSidebar
        mode="spa"
        activeSection={section}
        onSelectSection={selectSection}
        onToast={showToast}
      >
          {section === "home" ? (
            <>
            <section className="page active home-hero" aria-labelledby="home-title">
              <div className="home-hero-content">
              <div className="home-greeting" aria-hidden="true">
                <span className="greeting-diamond" /> {homeSubtitle || "个人技术博客"}
              </div>
              <h1 className="home-title" id="home-title">
                写代码，记运维，
                <br />
                聊<span>独立产品</span>。
              </h1>
              <p className="home-sub">
                <TypingEffect phrases={typingPhrases} className="home-typing" />
              </p>

              <div className="quick-actions">
                <button
                  type="button"
                  onClick={() => selectSection("blog")}
                  className="quick-btn primary"
                >
                  阅读最新文章
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>

              <div className="metrics-grid">
                {homeStats.map((metric, index) => (
                  <MetricCard index={index} key={metric.label} metric={metric} />
                ))}
              </div>

              {/* About + Tech stack */}
              <section className="section-block">
                <h2 className="section-title">关于本站</h2>
                <p className="about-text">
                  这里是馒头的<strong>个人技术博客</strong>，主要写开发、运维、独立产品与内容变现相关的内容。
                  公开文章免费阅读并做好 SEO，深度内容可通过会员或卡密解锁。本站也运营自研工具<strong>馒头助手</strong>（iOS 应用安装，支持香色闺阁、源阅读等）。
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

              {publishedCardProducts.length > 0 && (
                <section className="section-block mt-8">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="section-title" style={{ margin: 0 }}>
                      在售卡密
                    </h2>
                    <button
                      type="button"
                      className="quick-btn ghost"
                      style={{ padding: "8px 14px", fontSize: 12 }}
                      onClick={() => selectSection("shop")}
                    >
                      查看全部
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="product-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                    {publishedCardProducts.slice(0, 3).map((product, index) => (
                      <ProductCard
                        index={index}
                        key={product.id}
                        product={product}
                        loggedIn={isLoggedIn}
                        onBuy={handleBuyProduct}
                        onSelect={openProductDetail}
                      />
                    ))}
                  </div>
                </section>
              )}

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
              </div>
            </section>
            </>
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
                <p className="page-desc">购买会员或卡密需先登录，支付成功后可在会员中心查看订单与卡密。</p>
              </div>
              {!isLoggedIn ? (
                <div
                  className="mb-6 p-4 rounded-lg text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  请先登录后再购买商品。
                  <Link href="/login?callbackUrl=%2F%3Fsection%3Dshop" style={{ color: "var(--accent)", marginLeft: 8 }}>
                    去登录 →
                  </Link>
                </div>
              ) : null}
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
                {filteredProducts.length === 0 ? (
                  <div
                    className="text-center py-12 text-sm"
                    style={{ color: "var(--text-muted)", fontFamily: '"JetBrains Mono", monospace', gridColumn: "1 / -1" }}
                  >
                    暂无商品。管理员在后台「卡密管理 → 商品管理」发布卡密商品后会显示在这里。
                  </div>
                ) : (
                  filteredProducts.map((product, index) => (
                    <ProductCard
                      index={index}
                      key={product.id}
                      product={product}
                      loggedIn={isLoggedIn}
                      onBuy={handleBuyProduct}
                      onSelect={openProductDetail}
                    />
                  ))
                )}
              </div>
            </section>
          ) : null}

          {section === "daily" ? (
            <section className="page active" aria-labelledby="daily-title">
              <div className="page-head">
                <h2 className="page-title" id="daily-title">
                  日常记录
                </h2>
                <p className="page-desc">{"// 浏览动态，登录后可评论"}</p>
              </div>

              {!session ? (
                <div
                  className="mb-6 p-4 rounded-lg text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  登录后可购买会员、评论文章与日常动态。
                  <Link href="/login?callbackUrl=/" style={{ color: "var(--accent)", marginLeft: 8 }}>
                    去登录 →
                  </Link>
                </div>
              ) : (
                <div
                  className="mb-6 p-4 rounded-lg text-xs"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: '"DM Mono", monospace' }}
                >
                  日常记录由管理员在后台发布。登录后可在每条动态下方评论。
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
      </PlatformSidebar>

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

      <ProductDetailModal
        product={selectedProduct}
        open={productDetailOpen}
        loggedIn={isLoggedIn}
        onClose={() => {
          setProductDetailOpen(false);
          setSelectedProduct(null);
        }}
        onBuy={(product) => {
          setProductDetailOpen(false);
          handleBuyProduct(product);
        }}
      />

      <PaymentCheckout
        order={checkoutOrder}
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onPaid={() => {}}
      />

      <div className={clsx("toast", toast && "show")} role="status" aria-live="polite">
        <Sparkles size={14} aria-hidden="true" />
        {toast}
      </div>
    </>
  );
}

export function PlatformShell() {
  return (
    <Suspense fallback={null}>
      <PlatformShellInner />
    </Suspense>
  );
}
