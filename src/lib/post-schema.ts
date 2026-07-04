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