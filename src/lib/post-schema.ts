import { z } from "zod";
import { isSafeCoverImageUrl } from "@/lib/safe-image-url";

/** 封面：/uploads/、受限 data URL（禁 SVG）、或 https 外链 */
export const coverImageSchema = z
  .string()
  .max(2000)
  .optional()
  .nullable()
  .refine((val) => !val || isSafeCoverImageUrl(val), { message: "封面图地址无效" });

export const postSlugSchema = z
  .string()
  .min(1, "slug 不能为空")
  .max(200)
  .regex(/^[a-z0-9-]+$/, "slug 只允许小写字母、数字和横线");

const nullableTrimmedString = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => value || null);

const seoKeywordsSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(12, "SEO 关键词最多 12 个")
  .optional()
  .nullable()
  .transform((keywords) => {
    if (keywords === undefined) return undefined;
    if (keywords === null) return null;
    return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  });

/** 文章级搜索与社交分享元数据。所有字段均可留空并回退到文章内容。 */
export const postSeoFieldsSchema = z
  .object({
    seoTitle: nullableTrimmedString(60, "SEO 标题最多 60 个字符"),
    seoDescription: nullableTrimmedString(160, "SEO 描述最多 160 个字符"),
    seoKeywords: seoKeywordsSchema,
    socialTitle: nullableTrimmedString(70, "社交分享标题最多 70 个字符"),
    socialDescription: nullableTrimmedString(200, "社交分享描述最多 200 个字符"),
  })
  .strict();

export type PostSeoFields = z.infer<typeof postSeoFieldsSchema>;

export function readSeoKeywords(value: unknown): string[] {
  const parsed = seoKeywordsSchema.safeParse(value);
  return parsed.success && Array.isArray(parsed.data) ? parsed.data : [];
}
