import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { z } from "zod";
import { DEFAULT_HOME_TYPING_PHRASES, invalidateSiteSettingsCache } from "@/lib/site-settings";

const SETTING_KEYS = [
  "siteName",
  "siteSubtitle",
  "siteDescription",
  "siteUrl",
  "adminEmail",
  "postsPerPage",
  "timezone",
  "openRegistration",
  "commentReview",
  "maintenanceMode",
  "homeTypingPhrases",
] as const;

// 严格白名单：只允许这 10 个 key，其它字段直接报错。
// 此前开放 Object.entries(body) 会写入任意 key，存在污染 / 覆盖风险。
const settingsSchema = z
  .object({
    siteName: z.string().max(100).optional(),
    siteSubtitle: z.string().max(200).optional(),
    siteDescription: z.string().max(1000).optional(),
    siteUrl: z.string().url().optional().or(z.literal("")),
    adminEmail: z.string().email().optional().or(z.literal("")),
    postsPerPage: z.union([z.string(), z.number()]).optional(),
    timezone: z.string().max(50).optional(),
    openRegistration: z.boolean().optional(),
    commentReview: z.boolean().optional(),
    maintenanceMode: z.boolean().optional(),
    homeTypingPhrases: z.string().max(8000).optional(),
  })
  .strict();

function parseHomeTypingPhrases(raw: string | undefined): string[] {
  if (!raw?.trim()) return DEFAULT_HOME_TYPING_PHRASES;
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines.slice(0, 12) : DEFAULT_HOME_TYPING_PHRASES;
}

export async function GET() {
  try {
    await requireAdmin();

    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    });
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    return ok({
      siteName: map.siteName || "馒头的博客",
      siteSubtitle: map.siteSubtitle || "",
      siteDescription: map.siteDescription || "",
      siteUrl: map.siteUrl || "",
      adminEmail: map.adminEmail || "",
      postsPerPage: map.postsPerPage || "10",
      timezone: map.timezone || "Asia/Shanghai",
      openRegistration: map.openRegistration !== "false",
      commentReview: map.commentReview !== "false",
      maintenanceMode: map.maintenanceMode === "true",
      homeTypingPhrases: (() => {
        if (!map.homeTypingPhrases) {
          return DEFAULT_HOME_TYPING_PHRASES.join("\n");
        }
        try {
          const parsed = JSON.parse(map.homeTypingPhrases);
          if (Array.isArray(parsed)) {
            return parsed
              .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
              .join("\n");
          }
        } catch {
          /* fall through */
        }
        return map.homeTypingPhrases;
      })(),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Settings GET Error]", error);
    return fail("获取设置失败", 50000, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const entries = Object.entries(parsed.data) as [string, string | number | boolean][];
    for (const [key, value] of entries) {
      const stored =
        key === "homeTypingPhrases"
          ? JSON.stringify(parseHomeTypingPhrases(String(value)))
          : String(value);
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: stored, type: key === "homeTypingPhrases" ? "json" : "string" },
        create: { key, value: stored, type: key === "homeTypingPhrases" ? "json" : "string" },
      });
    }

    invalidateSiteSettingsCache();
    return ok({ saved: true, count: entries.length });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Admin Settings PUT Error]", error);
    return fail("保存设置失败", 50000, 500);
  }
}
