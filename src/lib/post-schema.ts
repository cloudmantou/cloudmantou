import { z } from "zod";

/** 封面：支持绝对 URL、站内相对路径、data URL */
export const coverImageSchema = z
  .string()
  .max(2000)
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val) return true;
      if (val.startsWith("/") || val.startsWith("data:image/")) return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "封面图地址无效" }
  );

export const postSlugSchema = z
  .string()
  .min(1, "slug 不能为空")
  .max(200)
  .regex(/^[a-z0-9-]+$/, "slug 只允许小写字母、数字和横线");