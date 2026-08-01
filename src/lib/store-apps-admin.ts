import { z } from "zod";
import { isSafeCoverImageUrl } from "@/lib/safe-image-url";
import { isSupportedStoreInstallUrl, STORE_APP_CATEGORIES } from "@/lib/store-apps";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const imageUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(isSafeCoverImageUrl, "图片地址仅支持本站上传路径或 HTTPS 地址");

const fields = {
  name: z.string().trim().min(1, "名称不能为空").max(120),
  slug: z
    .string()
    .trim()
    .min(1, "slug 不能为空")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug 仅支持小写字母、数字和连字符"),
  tagline: optionalText(200),
  description: z.string().trim().min(1, "描述不能为空").max(8000),
  iconUrl: imageUrl.optional().nullable(),
  coverUrl: imageUrl.optional().nullable(),
  screenshots: z.array(imageUrl).max(12, "截图最多 12 张").optional(),
  category: z.enum(STORE_APP_CATEGORIES),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(-10000).max(10000).optional(),
  published: z.boolean().optional(),
  installUrl: z
    .string()
    .trim()
    .max(2000)
    .refine(isSupportedStoreInstallUrl, "安装地址仅支持 HTTPS、mantou 或 itms-services 协议")
    .optional()
    .nullable(),
  minIos: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d+(?:\.\d+){0,2}$/, "最低 iOS 版本格式无效")
    .optional()
    .nullable(),
};

export const createStoreAppSchema = z.object(fields);

export const updateStoreAppSchema = z
  .object(fields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, "至少提供一个需要更新的字段");
