import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { AiConfigurationError } from "@/lib/ai/config";
import {
  AiGenerationError,
  generateEditorialSuggestion,
} from "@/lib/ai/editor-service";
import {
  ApiError,
  requireAdminAndAudit,
  requireAdminAndStrictAudit,
} from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit-server";
import {
  readRequestBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/request-body";
import {
  computePostTranslationSourceHash,
  type PostTranslationSource,
  validateTranslationPreservesSource,
} from "@/lib/post-translation-source";

export const runtime = "nodejs";

const ENGLISH_LOCALE = "en-US";
const MAX_TRANSLATABLE_CONTENT_LENGTH = 100_000;
const TRANSLATION_BODY_LIMIT_BYTES = 128 * 1024;
const TRANSLATION_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
  scope: "admin-post-translation",
} as const;

const generateSchema = z.object({}).strict();
const nullableTrimmed = (maximum: number) => z.string().trim().max(maximum).nullable();
const translationMutationSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    excerpt: nullableTrimmed(500),
    content: z.string().trim().min(10).max(100_000),
    seoTitle: nullableTrimmed(120),
    seoDescription: nullableTrimmed(320),
    seoKeywords: z.array(z.string().trim().min(1).max(60)).max(12),
    socialTitle: nullableTrimmed(140),
    socialDescription: nullableTrimmed(400),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const PUBLIC_TRANSLATION_SOURCE_SELECT = {
  id: true,
  title: true,
  excerpt: true,
  content: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  socialTitle: true,
  socialDescription: true,
  status: true,
  updatedAt: true,
} as const;

async function parseJsonBody(req: NextRequest): Promise<unknown> {
  const rawBody = await readRequestBodyWithLimit(req, TRANSLATION_BODY_LIMIT_BYTES);
  if (!rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ApiError("请求内容格式错误", 42200, 422);
  }
}

function isTranslationStale(
  translation: { status: string; sourceHash: string },
  source: PostTranslationSource,
): boolean {
  return translation.status === "STALE"
    || translation.sourceHash !== computePostTranslationSourceHash(source);
}

function knownErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.code, error.status);
  }
  if (error instanceof RequestBodyTooLargeError) {
    return fail("请求内容过大", 41300, 413);
  }
  if (error instanceof AiConfigurationError) {
    const message = error.code === "AI_INVALID_CONFIG"
      ? "AI 服务配置无效"
      : "AI 模型尚未配置，请前往系统设置完成配置";
    return fail(message, 50310, 503);
  }
  if (error instanceof AiGenerationError) {
    return fail(
      error.code === "AI_INVALID_OUTPUT" ? "AI 返回内容格式错误" : "AI 内容生成失败",
      50210,
      502,
    );
  }
  if (error instanceof Error && error.name === "AbortError") {
    return fail("AI 请求已取消", 49900, 499);
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireAdminAndAudit(req, "posts.translation.read", {
      targetType: "post",
      targetId: id,
    });
    const [post, translation] = await Promise.all([
      prisma.post.findUnique({
        where: { id },
        select: PUBLIC_TRANSLATION_SOURCE_SELECT,
      }),
      prisma.postTranslation.findUnique({
        where: { postId_locale: { postId: id, locale: ENGLISH_LOCALE } },
      }),
    ]);
    if (!post) return fail("文章不存在", 40400, 404);
    if (post.status === "PAID_ONLY") {
      return fail("付费文章暂不生成公开英文译文", 40920, 409);
    }

    return ok({
      translation,
      stale: translation ? isTranslationStale(translation, post) : false,
    });
  } catch (error) {
    const known = knownErrorResponse(error);
    if (known) return known;
    console.error("[Admin Read Post Translation Error]", error instanceof Error ? error.name : "UnknownError");
    return fail("获取英文译文失败", 50000, 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await requireAdminAndStrictAudit(req, "posts.translation.generate", {
      targetType: "post",
      targetId: id,
    });
    const rateLimited = await checkRateLimit(req, TRANSLATION_RATE_LIMIT, session.user.id);
    if (rateLimited) return rateLimited;

    const parsed = generateSchema.safeParse(await parseJsonBody(req));
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message || "英文译文请求参数错误", 42200, 422);
    }

    // This projection is deliberately allow-listed: paidContent is never loaded
    // into memory and therefore cannot be sent to the model by this endpoint.
    const [source, existingTranslation] = await Promise.all([
      prisma.post.findUnique({
        where: { id },
        select: PUBLIC_TRANSLATION_SOURCE_SELECT,
      }),
      prisma.postTranslation.findUnique({
        where: { postId_locale: { postId: id, locale: ENGLISH_LOCALE } },
      }),
    ]);
    if (!source) return fail("文章不存在", 40400, 404);
    if (source.status !== "PUBLISHED") {
      return fail(
        source.status === "PAID_ONLY"
          ? "付费文章暂不生成公开英文译文"
          : "请先发布中文原文，再生成英文草稿",
        source.status === "PAID_ONLY" ? 40920 : 40922,
        409,
      );
    }
    if (source.content.length > MAX_TRANSLATABLE_CONTENT_LENGTH) {
      return fail("文章正文过长，请精简后再生成英文草稿", 42201, 422);
    }
    if (
      existingTranslation?.status === "PUBLISHED"
      && !isTranslationStale(existingTranslation, source)
    ) {
      return fail("英文版已发布，请直接编辑；原文更新后才需要重新生成", 40924, 409);
    }
    const sourceHash = computePostTranslationSourceHash(source);

    const generated = await generateEditorialSuggestion({
      task: "translate",
      title: source.title,
      excerpt: source.excerpt ?? "",
      content: source.content,
      locale: "en-US",
      focusKeyword: "",
    }, { signal: req.signal });
    if (generated.task !== "translate") {
      throw new AiGenerationError("AI_INVALID_OUTPUT", "AI 返回内容格式错误");
    }
    const invariants = validateTranslationPreservesSource(source, generated.result);
    if (!invariants.ok) {
      throw new AiGenerationError("AI_INVALID_OUTPUT", "AI 译文缺少原文中的受保护结构");
    }
    const { language: _language, ...translatedFields } = generated.result;

    const translation = await prisma.$transaction(async (tx) => {
      const [currentSource, currentTranslation] = await Promise.all([
        tx.post.findFirst({
          where: {
            id,
            status: "PUBLISHED",
          },
          select: PUBLIC_TRANSLATION_SOURCE_SELECT,
        }),
        tx.postTranslation.findUnique({
          where: { postId_locale: { postId: id, locale: ENGLISH_LOCALE } },
        }),
      ]);
      if (!currentSource || computePostTranslationSourceHash(currentSource) !== sourceHash) {
        throw new ApiError("原文已更新，请重新生成英文译文", 40921, 409);
      }
      if (
        currentTranslation?.status === "PUBLISHED"
        && !isTranslationStale(currentTranslation, currentSource)
      ) {
        throw new ApiError("英文版已发布，请直接编辑；原文更新后才需要重新生成", 40924, 409);
      }
      const existingVersion = existingTranslation?.updatedAt?.getTime() ?? null;
      const currentVersion = currentTranslation?.updatedAt?.getTime() ?? null;
      if (
        existingTranslation?.id !== currentTranslation?.id
        || existingVersion !== currentVersion
        || existingTranslation?.status !== currentTranslation?.status
        || existingTranslation?.sourceHash !== currentTranslation?.sourceHash
      ) {
        throw new ApiError("英文译文已被其他操作更新，请刷新后重试", 40923, 409);
      }

      return tx.postTranslation.upsert({
        where: { postId_locale: { postId: id, locale: ENGLISH_LOCALE } },
        create: {
          postId: id,
          locale: ENGLISH_LOCALE,
          ...translatedFields,
          status: "DRAFT",
          sourceHash,
          sourceUpdatedAt: source.updatedAt,
          provider: generated.provider,
          model: generated.model,
        },
        update: {
          ...translatedFields,
          status: "DRAFT",
          sourceHash,
          sourceUpdatedAt: source.updatedAt,
          provider: generated.provider,
          model: generated.model,
          publishedAt: null,
        },
      });
    }, { isolationLevel: "Serializable" });

    return ok({ translation, stale: false });
  } catch (error) {
    const known = knownErrorResponse(error);
    if (known) return known;
    console.error("[Admin Generate Post Translation Error]", error instanceof Error ? error.name : "UnknownError");
    return fail("生成英文译文失败", 50000, 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireAdminAndStrictAudit(req, "posts.translation.update", {
      targetType: "post",
      targetId: id,
    });
    const parsed = translationMutationSchema.safeParse(await parseJsonBody(req));
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message || "英文译文参数错误", 42200, 422);
    }

    const { updatedAt, status, ...translatedFields } = parsed.data;
    const expectedUpdatedAt = new Date(updatedAt);
    const translation = await prisma.$transaction(async (tx) => {
      const [post, existing] = await Promise.all([
        tx.post.findFirst({
          where: { id },
          select: PUBLIC_TRANSLATION_SOURCE_SELECT,
        }),
        tx.postTranslation.findUnique({
          where: { postId_locale: { postId: id, locale: ENGLISH_LOCALE } },
        }),
      ]);
      if (!post) throw new ApiError("文章不存在", 40400, 404);
      if (post.status === "PAID_ONLY") {
        throw new ApiError("付费文章暂不发布公开英文译文", 40920, 409);
      }
      if (!existing) throw new ApiError("英文译文不存在，请先生成草稿", 40410, 404);
      if (isTranslationStale(existing, post)) {
        throw new ApiError("原文已更新，请重新生成英文译文", 40921, 409);
      }
      const invariants = validateTranslationPreservesSource(post, translatedFields);
      if (!invariants.ok) {
        throw new ApiError("英文译文必须保留原文中的链接、代码和版本号", 42202, 422);
      }
      if (status === "PUBLISHED" && post.status !== "PUBLISHED") {
        throw new ApiError("原文发布后才能发布英文译文", 40922, 409);
      }
      if (existing.status === "PUBLISHED" && status === "DRAFT") {
        throw new ApiError("已发布英文版不能通过保存草稿下线", 40925, 409);
      }

      const updateResult = await tx.postTranslation.updateMany({
        where: {
          id: existing.id,
          updatedAt: expectedUpdatedAt,
          sourceHash: existing.sourceHash,
        },
        data: {
          ...translatedFields,
          status,
          publishedAt: status === "PUBLISHED" ? existing.publishedAt ?? new Date() : null,
        },
      });
      if (updateResult.count !== 1) {
        throw new ApiError("英文译文已被其他操作更新，请刷新后重试", 40923, 409);
      }

      return tx.postTranslation.findUnique({
        where: { postId_locale: { postId: id, locale: ENGLISH_LOCALE } },
      });
    }, { isolationLevel: "Serializable" });
    return ok({ translation, stale: false });
  } catch (error) {
    const known = knownErrorResponse(error);
    if (known) return known;
    console.error("[Admin Update Post Translation Error]", error instanceof Error ? error.name : "UnknownError");
    return fail("更新英文译文失败", 50000, 500);
  }
}
