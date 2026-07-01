import type { BlogPost, DashboardMetric, Product, TimelineItem } from "@/types";

export const stats: DashboardMetric[] = [
  { label: "技术文章", value: "128", delta: "+12 本月", accent: "gold" },
  { label: "付费会员", value: "2.1k", delta: "+18.4%", accent: "teal" },
  { label: "自动发卡", value: "9.6k", delta: "99.2% 成功", accent: "blue" },
  { label: "月收入", value: "¥38k", delta: "+24.8%", accent: "rose" }
];

export const posts: BlogPost[] = [
  {
    id: "next-rsc-membership",
    category: "frontend",
    title: "Next.js App Router 下的会员内容架构",
    excerpt: "把公开文章、付费章节、会员权限和 SEO 放在同一个内容模型里，避免后期拆分成本。",
    date: "2026-06-30",
    readTime: "8 min",
    tags: [
      { label: "Next.js", accent: "gold" },
      { label: "RSC", accent: "teal" }
    ],
    cover:
      "linear-gradient(135deg, rgba(232,185,100,0.22), rgba(77,217,182,0.16)), url('https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80')",
    icon: "RSC",
    premium: false,
    content: [
      "公开文章和付费内容不要拆成两套文章系统。更稳的做法是 Post 负责公开结构，PaidContent 只保存隐藏部分和价格。",
      "渲染时先输出公开摘要和目录，再根据 session、订单或卡密兑换产生的 entitlement 决定是否拼接付费段落。",
      "这样可以让 SEO、归档、评论、统计和后台编辑都只围绕 Post 工作，付费只是文章能力的一种扩展。"
    ]
  },
  {
    id: "card-delivery-flow",
    category: "backend",
    title: "自动发卡系统的订单、库存与补偿链路",
    excerpt: "支付回调不等于交付完成。卡密平台必须把库存锁定、发放、失败重试和人工补发分层记录。",
    date: "2026-06-28",
    readTime: "12 min",
    tags: [
      { label: "Order", accent: "rose" },
      { label: "Card", accent: "blue" }
    ],
    cover:
      "linear-gradient(135deg, rgba(232,99,122,0.2), rgba(107,154,255,0.14)), url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80')",
    icon: "KEY",
    premium: true,
    content: [
      "订单进入 PAID 之后，交付服务再从可售库存中选择卡密，并写入 delivery record。",
      "如果库存不足或第三方回调重复，幂等键必须挡住重复发放，同时把失败状态暴露给后台补偿队列。",
      "后台不要只显示支付成功，要显示支付、交付、通知三个独立状态。"
    ]
  },
  {
    id: "admin-ops-dashboard",
    category: "product",
    title: "个人知识产品后台应该先看什么指标",
    excerpt: "比起宽泛大屏，更有用的是内容转化、付费漏斗、卡密库存和异常订单四组可操作指标。",
    date: "2026-06-25",
    readTime: "6 min",
    tags: [
      { label: "Ops", accent: "orange" },
      { label: "Dashboard", accent: "teal" }
    ],
    cover:
      "linear-gradient(135deg, rgba(240,152,72,0.2), rgba(77,217,182,0.13)), url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80')",
    icon: "OPS",
    premium: false,
    content: [
      "首页仪表盘只保留能推动动作的数据：今天新增、近七天收入、待审核评论、低库存套餐和失败订单。",
      "文章管理页才展示浏览、评论和购买转化。卡密管理页展示批次、库存、使用者和禁用操作。",
      "这比堆很多图表更适合个人站长每天重复使用。"
    ]
  },
  {
    id: "payment-callback",
    category: "devops",
    title: "支付回调上线前的验签与重放防护清单",
    excerpt: "上线支付前先把签名验证、订单状态机、回调日志、告警和补偿脚本跑通。",
    date: "2026-06-20",
    readTime: "10 min",
    tags: [
      { label: "Payment", accent: "gold" },
      { label: "Security", accent: "rose" }
    ],
    cover:
      "linear-gradient(135deg, rgba(232,185,100,0.18), rgba(232,99,122,0.16)), url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80')",
    icon: "PAY",
    premium: true,
    content: [
      "支付回调接口必须只接受平台签名通过的请求，不要把前端传回的支付结果作为订单完成依据。",
      "订单状态转移要保持单向：PENDING 可以到 PAID、EXPIRED 或 CANCELLED，PAID 不能被普通回调覆盖。",
      "每次回调原文都要留存，方便对账和排查渠道异常。"
    ]
  }
];

export const products: Product[] = [
  {
    id: "vip-month",
    category: "membership",
    name: "月度会员",
    description: "解锁所有会员文章、下载附件和会员评论标识。",
    price: "¥29",
    stock: 999,
    badge: "HOT",
    accent: "gold",
    cover:
      "linear-gradient(135deg, rgba(232,185,100,0.28), rgba(232,185,100,0.04)), url('https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=800&q=80')"
  },
  {
    id: "vip-year",
    category: "membership",
    name: "年度会员",
    description: "适合长期订阅，包含后续新增会员专栏。",
    price: "¥199",
    stock: 999,
    badge: "SAVE",
    accent: "teal",
    cover:
      "linear-gradient(135deg, rgba(77,217,182,0.26), rgba(77,217,182,0.04)), url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80')"
  },
  {
    id: "paid-article-token",
    category: "paid-post",
    name: "付费文章兑换券",
    description: "用于单篇深度文章解锁，可批量赠送。",
    price: "¥9.9",
    stock: 84,
    badge: "NEW",
    accent: "blue",
    cover:
      "linear-gradient(135deg, rgba(107,154,255,0.28), rgba(107,154,255,0.04)), url('https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80')"
  },
  {
    id: "card-batch",
    category: "card",
    name: "卡密批量包",
    description: "面向社群分发，支持批次管理和 CSV 导出。",
    price: "¥99",
    stock: 18,
    badge: "LOW",
    accent: "rose",
    cover:
      "linear-gradient(135deg, rgba(232,99,122,0.28), rgba(232,99,122,0.04)), url('https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80')"
  }
];

export const timeline: TimelineItem[] = [
  {
    id: "mvp",
    date: "2026-06-30",
    mood: "architecture",
    accent: "gold",
    text: "完成 CloudMantou 的博客、会员、卡密和后台一体化信息架构。"
  },
  {
    id: "payments",
    date: "2026-07-02",
    mood: "payment",
    accent: "teal",
    text: "支付回调先做验签、幂等和订单状态机，再接发卡交付。"
  },
  {
    id: "admin",
    date: "2026-07-05",
    mood: "ops",
    accent: "blue",
    text: "后台优先建设文章管理、卡密库存、订单列表和系统设置。"
  }
];

export const adminRows = [
  { label: "待审核评论", value: "12", status: "需要处理" },
  { label: "低库存套餐", value: "3", status: "建议补货" },
  { label: "失败支付回调", value: "1", status: "待复核" },
  { label: "今日付费文章", value: "46", status: "转化稳定" }
];

export const demoCards = [
  {
    id: "card-1",
    cardNo: "CM-VIP-2026",
    cardSecret: "STAR-OPEN",
    type: "VIP_DAYS" as const,
    value: 30,
    status: "ACTIVE" as const,
    expireAt: "2027-01-01T00:00:00.000Z"
  }
];
