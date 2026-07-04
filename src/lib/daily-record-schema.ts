import { z } from "zod";

/** 仅允许本站上传路径或 https 外链，防止 javascript: 等危险协议 */
export const dailyPhotoUrlSchema = z
  .string()
  .max(512, "图片地址过长")
  .refine(
    (url) => /^\/uploads\/[\w./-]+$/.test(url) || /^https?:\/\/[^\s]+$/i.test(url),
    "图片地址格式不正确"
  );

export const dailyRecordCreateSchema = z.object({
  content: z.string().min(1, "内容不能为空").max(2000, "内容不能超过2000字"),
  photos: z.array(dailyPhotoUrlSchema).max(9, "最多上传9张图片").optional(),
  mood: z.string().max(10).optional(),
  weather: z.string().max(10).optional(),
  location: z.string().max(100).optional(),
  visibility: z.enum(["public", "link", "private", "friends"]).optional(),
  tagNames: z.array(z.string()).max(10).optional(),
});

export const dailyRecordUpdateSchema = z.object({
  isTop: z.boolean().optional(),
  visibility: z.enum(["public", "link", "private", "friends"]).optional(),
});