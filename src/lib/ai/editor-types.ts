import { z } from "zod";

const languageSchema = z.enum(["zh-CN", "en-US"]);

export const editorAiInputSchema = z
  .object({
    task: z.enum(["title", "summary"]),
    title: z.string().trim().max(200).default(""),
    excerpt: z.string().trim().max(500).default(""),
    content: z.string().trim().min(10, "文章正文至少需要 10 个字符").max(100_000),
    locale: z.enum(["auto", "zh-CN", "en-US"]).default("auto"),
  })
  .strict();

export const titleSuggestionSchema = z
  .object({
    language: languageSchema,
    titles: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(120),
            reason: z.string().trim().min(1).max(200),
          })
          .strict(),
      )
      .length(5),
  })
  .strict();

export const summarySuggestionSchema = z
  .object({
    language: languageSchema,
    excerpt: z.string().trim().min(1).max(500),
    keyPoints: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
    keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  })
  .strict();

const usageSchema = z
  .object({
    inputTokens: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(),
    totalTokens: z.number().nonnegative().optional(),
  })
  .strict();

export const editorAiResponseSchema = z.discriminatedUnion("task", [
  z
    .object({
      task: z.literal("title"),
      provider: z.string().min(1),
      model: z.string().min(1),
      result: titleSuggestionSchema,
      usage: usageSchema,
    })
    .strict(),
  z
    .object({
      task: z.literal("summary"),
      provider: z.string().min(1),
      model: z.string().min(1),
      result: summarySuggestionSchema,
      usage: usageSchema,
    })
    .strict(),
]);

export type EditorialAiInput = z.infer<typeof editorAiInputSchema>;
export type EditorialAiResponse = z.infer<typeof editorAiResponseSchema>;
