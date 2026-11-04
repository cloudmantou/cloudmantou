/**
 * 红笺墨语（iOS 阅读器）App Store 配套页面：产品介绍、技术支持、隐私政策、用户协议。
 *
 * 这些页面会被 App Store 审核人员打开，刻意不复用博客 / 官网外壳：
 * 不出现站点导航、会员卡密、IPA 下载或其他应用的链接，只讲这一个 App。
 */

export const HONGJIAN_APP = {
  name: "红笺墨语",
  englishName: "Hongjian Reader",
  operator: "mantou",
  bundleId: "com.mantou.mtsk1",
  minimumIos: "15.0",
  contactEmail: "modianwuhen@gmail.com",
  qqGroupUrl: "https://qm.qq.com/q/hnQ9sXO6Uo",
  basePath: "/apps/hongjian-moyu",
} as const;

export type HongjianPageKey = "home" | "support" | "privacy" | "terms";

export type HongjianSection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export type HongjianPageCopy = {
  path: string;
  navLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  updated?: string;
  sections: readonly HongjianSection[];
  englishSummary?: { title: string; paragraphs: readonly string[] };
};

const base = HONGJIAN_APP.basePath;

export const HONGJIAN_PAGES: Record<HongjianPageKey, HongjianPageCopy> = {
  home: {
    path: base,
    navLabel: "介绍",
    eyebrow: "iPhone · iPad 阅读工具",
    title: "红笺墨语",
    description:
      "整理书架、调整排版、阅读与听书，都按你的习惯来。导入本地 EPUB、TXT、PDF，离线也能读。",
    sections: [
      {
        title: "书架",
        items: [
          "书架、养肥区和已完本分类，列表与书封两种展示方式。",
          "阅读进度自动保存，下次打开从上次的位置继续。",
          "首次打开内置两本原创示例书，无需联网即可体验。",
        ],
      },
      {
        title: "本地导入",
        items: [
          "支持 EPUB、TXT、PDF，也可从「文件」App 直接打开。",
          "EPUB 与 TXT 按章节阅读，PDF 保留原始页面。",
          "导入的书籍保存在设备上，离线可读。",
        ],
      },
      {
        title: "阅读体验",
        items: [
          "字体、字号、行距、段距、页边距自由调整，可导入自己的字体。",
          "多种翻页方式，日间、夜间与多套阅读主题，支持导入主题包。",
          "繁简转换、目录跳转、书签。",
        ],
      },
      {
        title: "听书",
        items: [
          "系统语音朗读，可调语速与音色。",
          "内置「官方听书模型」，也可配置你自己的兼容云端语音服务。",
          "后台与锁屏继续播放，阅读与听书进度分别保存。",
        ],
      },
      {
        title: "书源与备份",
        items: [
          "可导入你自己的书源规则，访问你有权使用的网站内容。",
          "支持导出备份，或通过 WebDAV 同步到你自己的服务器。",
        ],
      },
      {
        title: "关于内容",
        paragraphs: [
          "红笺墨语是阅读工具，不内置、不推荐、也不提供任何第三方内容来源。通过书源访问的内容及其权利归相应网站所有，请仅访问你有权使用的内容。",
          `支持 iOS ${HONGJIAN_APP.minimumIos} 及以上的 iPhone 与 iPad，请通过 App Store 获取。`,
        ],
      },
    ],
    englishSummary: {
      title: "In English",
      paragraphs: [
        "Hongjian Reader is a reading tool for iPhone and iPad. Organize your bookshelf, import EPUB, TXT and PDF files, adjust fonts, layout and themes, and listen with system or cloud text-to-speech.",
        "The app does not include or recommend any third-party content sources. Online content is only reachable through source rules that you import yourself.",
      ],
    },
  },
  support: {
    path: `${base}/support`,
    navLabel: "技术支持",
    eyebrow: "帮助与反馈",
    title: "技术支持",
    description: "使用中遇到问题，先看下面的常见问题；没有解决，可以通过邮件或用户群联系我们。",
    sections: [
      {
        title: "联系我们",
        items: [
          `邮箱：${HONGJIAN_APP.contactEmail}（标题请注明「红笺墨语」，一般 3 个工作日内回复）`,
          "用户群：在 App 内书架左上角侧栏「关于我们 → 意见反馈」可直接加入红笺墨语 QQ 群。",
          "反馈问题时请写明设备型号、iOS 版本、App 版本（在侧栏「关于我们」页查看），以及复现步骤和截图。",
        ],
      },
      {
        title: "发送诊断日志",
        paragraphs: [
          "在侧栏「关于我们 → 发送日志」可以生成最近的诊断日志。导出前会先显示预览，你可以排除某些类别或敏感字段，确认后通过系统分享面板发送给我们。日志只保存在设备上，不会自动上传。",
        ],
      },
      {
        title: "常见问题：示例书与本地导入",
        items: [
          "首次打开书架上的《红笺阅读示例》《红笺小日记》是原创示例，删除后重新安装 App 即可恢复。",
          "导入书籍：在书架页右上角选择导入，或在「文件」App 中选中 EPUB / TXT / PDF 后用红笺墨语打开。",
          "受密码或 DRM 保护的文件无法导入；扫描版 PDF 只能按页面阅读，不能听书。",
        ],
      },
      {
        title: "常见问题：书源",
        items: [
          "App 不提供任何书源。书源规则由你自行导入，内容、账户与可用性由对应网站决定。",
          "书源搜索不到或加载失败，多数是网站改版或网络问题，可在侧栏「站点管理」中检查或停用该书源。",
          "部分网站需要在其页面登录，登录信息只保存在本机，并按书源分开存放。",
        ],
      },
      {
        title: "常见问题：听书",
        items: [
          "系统语音在设备上处理，可在 iOS「设置 → 辅助功能 → 朗读内容 → 声音」下载更多音色。",
          "「官方听书模型」需要联网；如遇失败可切换到系统语音。",
          "自定义云端语音需要你自己的服务地址与密钥，密钥保存在系统钥匙串中。",
        ],
      },
      {
        title: "常见问题：备份与数据",
        items: [
          "侧栏「云备份」可导出书架、阅读进度、书源和设置，也可配置 WebDAV 自动同步。",
          "卸载 App 会删除本机数据，请先导出备份。",
          "隐私与数据删除请求请参阅隐私政策。",
        ],
      },
    ],
    englishSummary: {
      title: "Support in English",
      paragraphs: [
        `Email ${HONGJIAN_APP.contactEmail} with the subject "Hongjian Reader". Please include your device model, iOS version, app version and steps to reproduce. We usually reply within 3 business days.`,
      ],
    },
  },
  privacy: {
    path: `${base}/privacy`,
    navLabel: "隐私政策",
    eyebrow: "隐私政策",
    title: "红笺墨语隐私政策",
    description: `本政策适用于 ${HONGJIAN_APP.operator} 提供的红笺墨语 iOS 应用（套装 ID：${HONGJIAN_APP.bundleId}），说明应用实际处理的信息、用途和你的选择。`,
    updated: "更新及生效日期：2026 年 11 月 4 日 · 版本 1.1",
    sections: [
      {
        title: "我们不收集什么",
        paragraphs: [
          "红笺墨语没有开发者自建的账户系统，不含广告、统计或崩溃上报 SDK，不进行跨应用跟踪，也不出售任何个人信息。基础阅读无需注册。",
        ],
      },
      {
        title: "本地导入与阅读",
        paragraphs: [
          "你选取的 EPUB、PDF、TXT、字体、主题等文件，以及导入后生成的文本、封面、目录、书架记录、阅读进度、书签、阅读设置和缓存，都保存在设备中，用于展示、续读和离线使用，不会上传至开发者服务器。文件选择器只授予你所选文件的访问权限。",
        ],
      },
      {
        title: "听书",
        paragraphs: [
          "使用系统语音时，朗读文字交给 iOS 系统语音在设备上处理。",
          "使用「官方听书模型」时，应用会把当前要朗读的段落文字及音色、语速等参数发送给我们选用的语音合成服务提供方（小米 MiMo），以生成音频；请求不包含你的账户或设备标识。返回的音频可能在设备上缓存。该服务提供方对请求数据的处理适用其隐私政策。",
          "使用你自行配置的云端语音服务时，文字、合成参数和你填写的 API 凭据会发送到你指定的服务地址，适用该服务的条款。",
        ],
      },
      {
        title: "你导入的书源与第三方网站",
        paragraphs: [
          "当你导入书源规则、搜索、浏览在线内容或打开第三方网页时，对应网站会收到请求地址、搜索词、内容标识、IP 地址等必要信息。这些请求由你的设备直接发往你选择的网站，不经过开发者服务器。",
          "若你在第三方页面登录，账户信息和 Cookie 由该网站处理，Cookie 保存在本机并按书源分开存放。请仅使用可信的书源和网站。",
        ],
      },
      {
        title: "备份与同步",
        paragraphs: [
          "导出备份与 WebDAV 同步都由你主动配置。启用后，应用会把书源、书架与阅读进度、书签、阅读设置等备份上传到你指定的 WebDAV 服务器。备份不会自动脱敏：书源或请求头中如含你写入的令牌，也可能被导出，分享前请检查。WebDAV 密码与语音服务密钥保存在系统钥匙串中。",
        ],
      },
      {
        title: "诊断日志与反馈",
        paragraphs: [
          "诊断日志只保存在设备上，用于排查故障，可能包含应用与系统版本、请求地址、书名、章节标识和错误信息。只有当你在「发送日志」中预览并确认后，日志才会通过系统分享面板发送给你选择的接收方。",
          "你通过邮件、用户群或日志主动提交给我们的信息，只用于回复、排查问题和必要的安全处理，不用于广告画像，并在处理完成后不再需要时删除。",
        ],
      },
      {
        title: "保存、删除与你的选择",
        paragraphs: [
          "本地数据会一直保留，直到你在应用内删除相应书籍、记录或缓存，或卸载应用。卸载会移除应用容器数据，但系统钥匙串、系统备份、你的 WebDAV 服务器以及第三方网站上的数据需要分别管理。",
          `你可以随时发送邮件至 ${HONGJIAN_APP.contactEmail} 查询、更正或删除你提交给我们的信息。请勿在邮件中提供密码、API 密钥或完整 Cookie。`,
        ],
      },
      {
        title: "未成年人",
        paragraphs: [
          "未成年人请在监护人指导下使用文件导入和联网功能。若监护人发现相关信息被不当提交给我们，可联系我们删除。",
        ],
      },
      {
        title: "政策更新与联系方式",
        paragraphs: [
          "功能或数据处理方式变化时，我们会更新本页的内容和日期；需要新的授权时，会在相应功能中提示。",
          `运营者：${HONGJIAN_APP.operator}　隐私联系邮箱：${HONGJIAN_APP.contactEmail}（请注明「红笺墨语隐私」）`,
        ],
      },
    ],
    englishSummary: {
      title: "Summary in English",
      paragraphs: [
        "Hongjian Reader has no developer account system, no ads, no analytics and no tracking. Your books, progress and settings stay on your device.",
        "When you use the built-in \"Official read-aloud model\", the paragraph being read is sent to our text-to-speech provider (Xiaomi MiMo) to generate audio, without any account or device identifier. Requests to book sources, cloud voices or WebDAV servers that you configure go directly from your device to those services.",
        `Diagnostic logs stay on your device unless you choose to share them. Contact ${HONGJIAN_APP.contactEmail} for any privacy request.`,
      ],
    },
  },
  terms: {
    path: `${base}/terms`,
    navLabel: "用户协议",
    eyebrow: "用户协议",
    title: "红笺墨语用户协议",
    description: "使用红笺墨语前，请阅读本协议。下载、安装或使用即表示你同意本协议。",
    updated: "更新及生效日期：2026 年 11 月 4 日 · 版本 1.0",
    sections: [
      {
        title: "服务内容",
        paragraphs: [
          `红笺墨语是由 ${HONGJIAN_APP.operator} 提供的阅读与听书工具，帮助你管理和阅读你有权使用的电子书与内容。应用本身不提供、不托管、不推荐任何第三方书籍或内容来源。`,
        ],
      },
      {
        title: "你的内容与书源",
        paragraphs: [
          "你导入的文件、书源规则、字体和主题由你自行提供并负责。你应确保对其拥有合法的使用权，不得利用本应用访问、复制或传播侵犯他人著作权或其他合法权益的内容，也不得用于规避付费、加密或访问限制。",
          "通过书源访问的第三方网站，其内容、账户和服务条款由该网站负责。我们不对第三方内容的合法性、准确性和可用性作任何保证。",
        ],
      },
      {
        title: "第三方服务",
        paragraphs: [
          "「官方听书模型」由第三方语音合成服务提供，可能因额度、网络或服务商原因暂停或调整。你自行配置的云端语音、WebDAV 等服务适用其各自的条款与费用。",
        ],
      },
      {
        title: "许可与限制",
        paragraphs: [
          "我们授予你个人、非独占、不可转让的许可，在你拥有或控制的 Apple 设备上按 App Store 使用规则使用本应用。你不得对应用进行出售、出租或以违法方式使用。应用包含的开源组件适用其各自的开源许可，详见应用内说明。",
          "本协议是对 Apple 标准许可协议（Licensed Application End User License Agreement）的补充，二者冲突时以 Apple 标准许可协议为准。",
        ],
      },
      {
        title: "免责与责任限制",
        paragraphs: [
          "应用按「现状」提供。在法律允许的范围内，我们不保证应用不中断或无错误，也不对因使用第三方内容或服务、数据丢失或设备问题造成的间接损失承担责任。请定期备份重要数据。",
        ],
      },
      {
        title: "协议变更与联系",
        paragraphs: [
          "我们可能根据功能变化更新本协议，并在本页公布新版本和日期。继续使用即表示你接受更新后的协议。",
          `如有疑问，请联系 ${HONGJIAN_APP.contactEmail}。`,
        ],
      },
    ],
  },
};

export const HONGJIAN_NAV: readonly HongjianPageKey[] = ["home", "support", "privacy", "terms"];

export function getHongjianPage(key: HongjianPageKey): HongjianPageCopy {
  return HONGJIAN_PAGES[key];
}
