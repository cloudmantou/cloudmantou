import type {
  BlogPost,
  DashboardMetric,
  FavoriteItem,
  Product,
  TimelineItem,
} from "@/types";

export const stats: DashboardMetric[] = [
  { label: "公开文章", value: "12", delta: "持续更新", accent: "gold" },
  { label: "会员专栏", value: "3", delta: "深度内容", accent: "teal" },
  { label: "卡密库存", value: "84", delta: "自动兑换", accent: "blue" },
  { label: "最近更新", value: "Today", delta: "保持节奏", accent: "rose" }
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
    content:
      "公开文章和付费内容不要拆成两套文章系统。更稳的做法是 Post 负责公开结构，PaidContent 只保存隐藏部分和价格。\n\n渲染时先输出公开摘要和目录，再根据 session、订单或卡密兑换产生的 entitlement 决定是否拼接付费段落。\n\n这样可以让 SEO、归档、评论、统计和后台编辑都只围绕 Post 工作，付费只是文章能力的一种扩展。"
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
    content:
      "订单进入 PAID 之后，交付服务再从可售库存中选择卡密，并写入 delivery record。\n\n如果库存不足或第三方回调重复，幂等键必须挡住重复发放，同时把失败状态暴露给后台补偿队列。\n\n后台不要只显示支付成功，要显示支付、交付、通知三个独立状态。"
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
    content:
      "首页仪表盘只保留能推动动作的数据：今天新增、近七天收入、待审核评论、低库存套餐和失败订单。\n\n文章管理页才展示浏览、评论和购买转化。卡密管理页展示批次、库存、使用者和禁用操作。\n\n这比堆很多图表更适合个人站长每天重复使用。"
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
    content:
      "支付回调接口必须只接受平台签名通过的请求，不要把前端传回的支付结果作为订单完成依据。\n\n订单状态转移要保持单向：PENDING 可以到 PAID、EXPIRED 或 CANCELLED，PAID 不能被普通回调覆盖。\n\n每次回调原文都要留存，方便对账和排查渠道异常。"
  }
];

export const products: Product[] = [
  {
    id: "vip-month",
    category: "membership",
    name: "月度会员",
    description: "解锁所有会员文章、下载附件和会员评论标识。",
    intro:
      "适合想先体验一个月会员内容的读者。开通后可阅读全站会员文章、显示会员标识，并下载文章附件。\n\n到期前可续费，未过期续费会从当前到期日顺延。",
    highlights: ["全站会员文章", "附件下载", "会员评论标识", "随时可续费"],
    price: "¥29",
    stock: 999,
    badge: "HOT",
    accent: "gold",
    productType: "VIP_MONTH",
    cover:
      "linear-gradient(135deg, rgba(232,185,100,0.28), rgba(232,185,100,0.04)), url('https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=800&q=80')"
  },
  {
    id: "vip-year",
    category: "membership",
    name: "年度会员",
    description: "适合长期订阅，包含后续新增会员专栏。",
    intro:
      "为长期读者准备的优惠套餐。一次订阅全年有效，后续新增的会员专栏也会自动纳入权益范围。\n\n相比按月购买可节省约 40%，适合深度用户与团队学习账号。",
    highlights: ["全年会员权益", "新增专栏自动解锁", "性价比更高", "支持叠加续期"],
    price: "¥199",
    stock: 999,
    badge: "SAVE",
    accent: "teal",
    productType: "VIP_YEAR",
    cover:
      "linear-gradient(135deg, rgba(77,217,182,0.26), rgba(77,217,182,0.04)), url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80')"
  },
  {
    id: "paid-article-token",
    category: "paid-post",
    name: "付费文章兑换券",
    description: "用于单篇深度文章解锁，可批量赠送。",
    intro:
      "适合只想阅读某一篇深度技术文章的用户，也适合作者做活动赠送。\n\n兑换后可在会员中心输入卡号卡密，立即解锁对应付费章节，无需订阅整站会员。",
    highlights: [
      "单篇解锁，不必买整月会员",
      "卡密可转赠，适合社群活动",
      "兑换记录可在个人中心查看",
    ],
    price: "¥9.9",
    stock: 84,
    badge: "NEW",
    accent: "blue",
    cover:
      "linear-gradient(135deg, rgba(107,154,255,0.28), rgba(107,154,255,0.04)), url('https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80')"
  },
  {
    id: "card-vip-30",
    category: "card",
    name: "VIP 30 天卡密",
    description: "一次性卡密，兑换后自动延长 30 天会员权益。",
    intro:
      "面向不方便在线支付、或需要通过社群/代理分发的场景。每张卡密绑定固定权益时长，兑换成功后立即写入账户。\n\n适合个人站长做团购、抽奖、合作推广；后台可按批次生成、导出 CSV，并追踪使用状态。",
    highlights: [
      "兑换即开通，无需等待人工审核",
      "支持未过期会员叠加续期",
      "批次号可追溯，防止重复发放",
      "库存实时同步，低库存自动提醒",
    ],
    usageSteps: [
      "购买后在订单页或邮件中获取卡号与卡密",
      "进入「个人中心 → 卡密兑换」填写信息",
      "提交后系统自动验签并发放 VIP 权益",
      "刷新页面即可阅读会员文章与下载附件",
    ],
    price: "¥25",
    stock: 120,
    badge: "HOT",
    accent: "gold",
    productType: "CARD_PACKAGE",
    cover:
      "linear-gradient(135deg, rgba(232,185,100,0.32), rgba(232,185,100,0.06)), url('https://images.unsplash.com/photo-1556740758-90de374c12bac?auto=format&fit=crop&w=800&q=80')"
  },
  {
    id: "card-paid-article",
    category: "card",
    name: "付费文章解锁卡",
    description: "兑换后解锁一篇指定付费文章，适合单篇分销。",
    intro:
      "当你只想售卖某一门课程式长文、源码解读或付费专栏中的单篇内容时，用这张卡密比整站会员更精准。\n\n卡密类型为 PAID_ARTICLE，兑换后与订单购买享有相同阅读权限，默认有效期 1 年。",
    highlights: [
      "按篇售卖，转化路径更短",
      "可绑定具体文章 ID，避免误兑",
      "适合知识星球、社群福利发放",
      "支持导出未使用卡密做二次分发",
    ],
    usageSteps: [
      "确认卡密对应的文章标题与价格",
      "登录后在卡密兑换页输入卡号卡密",
      "系统校验通过后解锁该篇文章全文",
      "可在收藏夹或文章页继续阅读",
    ],
    price: "¥8",
    stock: 56,
    badge: "NEW",
    accent: "blue",
    productType: "CARD_PACKAGE",
    cover:
      "linear-gradient(135deg, rgba(107,154,255,0.3), rgba(107,154,255,0.05)), url('https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80')"
  },
  {
    id: "card-batch",
    category: "card",
    name: "卡密批量包（10 张）",
    description: "面向社群分发，含 10 张 VIP 卡密与批次管理权限。",
    intro:
      "为社群主、代理商、活动运营准备的标准化卡密包。一次购买获得固定数量未激活卡密，可在后台按批次导出、标记渠道来源。\n\n相比单张购买，批量包单价更低，并附带 CSV 导出与库存锁定能力，避免支付成功但库存不足导致的发放失败。",
    highlights: [
      "10 张 VIP 卡密，适合小型社群团购",
      "支持批次备注与渠道标记",
      "导出 CSV 后可交给客服或代理发放",
      "支付回调 + 自动交付双链路保障",
    ],
    usageSteps: [
      "下单支付成功后，在订单详情查看卡密包状态",
      "管理员后台按批次解锁并导出卡密列表",
      "将卡号卡密分发给终端用户或代理",
      "用户各自登录兑换，权益互不影响",
    ],
    price: "¥99",
    stock: 18,
    badge: "LOW",
    accent: "rose",
    productType: "CARD_PACKAGE",
    cover:
      "linear-gradient(135deg, rgba(232,99,122,0.28), rgba(232,99,122,0.04)), url('https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80')"
  }
];

export const timeline: TimelineItem[] = [
  {
    id: "day-1",
    date: "2026 年 7 月 2 日 · 周四",
    mood: "excited",
    moodLabel: "⚡ 兴奋",
    accent: "gold",
    text: "终于把 CloudMantou 的支付回调和自动发卡链路跑通了！微信支付签名验证踩了几个坑，但最终 P99 延迟控制在 200ms 以内。晚上准备写一篇上线复盘。",
    photos: [
      {
        gradient: "linear-gradient(135deg, rgba(232,185,100,0.2), rgba(77,217,182,0.12))",
        icon: "📊",
        label: "支付监控面板"
      },
      {
        gradient: "linear-gradient(135deg, rgba(74,111,165,0.2), rgba(63,125,88,0.12))",
        icon: "💻",
        label: "VS Code"
      }
    ],
    likes: 42,
    comments: 8
  },
  {
    id: "day-2",
    date: "2026 年 6 月 30 日 · 周二",
    mood: "productive",
    moodLabel: "💻 高产",
    accent: "teal",
    text: "重构了后台管理的文章、卡密和订单三个模块。把 Prisma 查询从 controller 抽到了 service 层，代码清爽了很多。Next.js App Router 的 server actions 真的很好用。",
    photos: [],
    likes: 67,
    comments: 15
  },
  {
    id: "day-3",
    date: "2026 年 6 月 28 日 · 周日",
    mood: "happy",
    moodLabel: "☺ 开心",
    accent: "rose",
    text: "周末不写代码！去了趟 798 艺术区看了个数字艺术展，有个项目是用 LLM 实时生成诗歌然后投影到空间装置上，AI + Art 的结合确实能带来全新体验。",
    photos: [
      {
        gradient: "linear-gradient(135deg, rgba(196,77,88,0.2), rgba(184,135,24,0.12))",
        icon: "🎨",
        label: "数字艺术装置",
        span: "tall"
      },
      {
        gradient: "linear-gradient(135deg, rgba(240,152,72,0.2), rgba(184,135,24,0.1))",
        icon: "🌆",
        label: "798 街区"
      },
      {
        gradient: "linear-gradient(135deg, rgba(74,111,165,0.18), rgba(63,125,88,0.1))",
        icon: "🖼️",
        label: "光影展厅"
      }
    ],
    likes: 89,
    comments: 22
  },
  {
    id: "day-4",
    date: "2026 年 6 月 25 日 · 周四",
    mood: "tired",
    moodLabel: "😴 疲惫",
    accent: "blue",
    text: "测试环境的 MySQL 连接池打满了，排查了两小时发现是一个慢查询没加索引。加了复合索引后查询时间从 3.2s 降到 12ms。教训：上线前一定要跑 EXPLAIN。",
    photos: [],
    likes: 31,
    comments: 9
  },
  {
    id: "day-5",
    date: "2026 年 6 月 20 日 · 周六",
    mood: "chill",
    moodLabel: "🎧 专注",
    accent: "orange",
    text: "泡了一天咖啡馆，把博客的视觉体系统一了一遍。Inter + JetBrains Mono 的字体组合很舒服，暖色调的 light/dark 双主题也调好了。写代码的时候听 Tycho，效率很高。",
    photos: [
      {
        gradient: "linear-gradient(135deg, rgba(192,120,48,0.18), rgba(232,185,100,0.1))",
        icon: "⌨️",
        label: "咖啡馆工位",
        span: "wide"
      }
    ],
    likes: 128,
    comments: 34
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

export const favorites: FavoriteItem[] = [
  {
    id: "fav-1",
    category: "post",
    title: "React Server Components 深度实践",
    description: "从零构建 RSC 应用，理解 Server/Client 组件边界和流式渲染。",
    icon: "⚛️",
    accent: "blue",
    tags: ["React", "RSC", "性能"],
    savedAt: "2026-07-01"
  },
  {
    id: "fav-2",
    category: "tool",
    title: "Cursor Pro",
    description: "AI 编程神器，代码补全和重构体验远超 Copilot。",
    icon: "⚡",
    accent: "teal",
    tags: ["AI", "IDE", "效率"],
    savedAt: "2026-06-28"
  },
  {
    id: "fav-3",
    category: "resource",
    title: "Frontend Interview Handbook",
    description: "前端面试指南，涵盖 React、算法、系统设计等核心考点。",
    icon: "📘",
    accent: "gold",
    tags: ["面试", "前端", "算法"],
    savedAt: "2026-06-25"
  },
  {
    id: "fav-4",
    category: "link",
    title: "Refactoring UI",
    description: "不需要设计师也能做出好看 UI 的实用技巧合集。",
    icon: "🎨",
    accent: "rose",
    tags: ["设计", "CSS", "UI"],
    savedAt: "2026-06-20"
  },
  {
    id: "fav-5",
    category: "tool",
    title: "Vercel Analytics",
    description: "真实用户性能监控，Core Web Vitals 一目了然。",
    icon: "📊",
    accent: "blue",
    tags: ["性能", "监控", "Web Vitals"],
    savedAt: "2026-06-18"
  },
  {
    id: "fav-6",
    category: "post",
    title: "PostgreSQL 17 新特性解读",
    description: "增量备份、JSON_TABLE 和性能调优的生产实践。",
    icon: "🐘",
    accent: "teal",
    tags: ["PostgreSQL", "数据库", "运维"],
    savedAt: "2026-06-15"
  },
  {
    id: "fav-7",
    category: "resource",
    title: "Rust 语言圣经",
    description: "中文 Rust 入门到进阶的完整教程，所有权系统讲得很清楚。",
    icon: "🦀",
    accent: "orange",
    tags: ["Rust", "教程", "后端"],
    savedAt: "2026-06-10"
  },
  {
    id: "fav-8",
    category: "link",
    title: "Excalidraw",
    description: "手绘风格的在线白板工具，画架构图和流程图很方便。",
    icon: "✏️",
    accent: "rose",
    tags: ["工具", "白板", "架构图"],
    savedAt: "2026-06-08"
  }
];
