export type Accent = "gold" | "teal" | "rose" | "blue" | "orange";

export type BlogCategory = "all" | "frontend" | "backend" | "devops" | "ai" | "product";

export type ProductCategory = "all" | "membership" | "paid-post" | "card" | "service";

export type PostTag = {
  label: string;
  accent: Accent;
};

export type BlogPost = {
  id: string;
  category: Exclude<BlogCategory, "all">;
  categoryName?: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  tags: PostTag[];
  cover: string;
  icon: string;
  premium: boolean;
  content: string;
  slug?: string;
};

export type Product = {
  id: string;
  category: Exclude<ProductCategory, "all">;
  name: string;
  description: string;
  /** 详情页长介绍，支持段落（\n\n 分隔） */
  intro?: string;
  highlights?: string[];
  /** 卡密类商品的使用步骤 */
  usageSteps?: string[];
  price: string;
  stock: number;
  badge: string;
  accent: Accent;
  cover: string;
  productType?: "VIP_MONTH" | "VIP_QUARTER" | "VIP_YEAR" | "PAID_POST" | "CARD_PACKAGE";
};

export type MoodType = "happy" | "productive" | "tired" | "excited" | "chill";

export type DailyPhoto = {
  gradient: string;
  icon: string;
  label: string;
  span?: "wide" | "tall";
};

export type TimelineItem = {
  id: string;
  date: string;
  mood: MoodType;
  moodLabel: string;
  text: string;
  accent: Accent;
  photos?: DailyPhoto[];
  likes?: number;
  comments?: number;
};

export type FavoriteCategory = "post" | "tool" | "resource" | "link";

export type FavoriteItem = {
  id: string;
  category: FavoriteCategory;
  title: string;
  description: string;
  icon: string;
  accent: Accent;
  url?: string;
  tags?: string[];
  savedAt: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  accent: Accent;
};
