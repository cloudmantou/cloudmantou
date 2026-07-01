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
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  tags: PostTag[];
  cover: string;
  icon: string;
  premium: boolean;
  content: string[];
  slug?: string;
};

export type Product = {
  id: string;
  category: Exclude<ProductCategory, "all">;
  name: string;
  description: string;
  price: string;
  stock: number;
  badge: string;
  accent: Accent;
  cover: string;
};

export type TimelineItem = {
  id: string;
  date: string;
  mood: string;
  text: string;
  accent: Accent;
};

export type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  accent: Accent;
};
