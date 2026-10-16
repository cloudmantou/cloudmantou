import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { requireAuth, ApiError } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { feedbackCreateSchema } from "@/lib/feedback";
import { feedbackInclude, feedbackPolicy, submitFeedback, feedbackPage } from "@/lib/feedback-server";
import { feedbackJson, privateOk, feedbackFail } from "@/lib/feedback-request";
import { checkRateLimit } from "@/lib/rate-limit-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string }> };
async function postFor(slug: string) {
  const p = await prisma.post.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!p || p.status === "DRAFT") throw new ApiError("文章不存在", 40400, 404);
  return p;
}
export async function GET(req: NextRequest, ctx: Context) {
  try {
    const [post, session, policy] = await Promise.all([ctx.params.then(p => postFor(p.slug)), auth(), feedbackPolicy()]);
    const page = feedbackPage(req);
    const where = { postId: post.id, ...(session?.user?.role === "ADMIN" ? {} : { OR: [{ published: true }, ...(session?.user?.id ? [{ userId: session.user.id }] : [])] }) };
    const [items, total] = await Promise.all([prisma.articleFeedback.findMany({ where, include: feedbackInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 10, take: 10 }), prisma.articleFeedback.count({ where })]);
    return privateOk({ items, page, total, hasMore: page * 10 < total, policy });
  } catch (e) { return feedbackFail(e); }
}
export async function POST(req: NextRequest, ctx: Context) {
  try {
    const session = await requireAuth();
    const limited = await checkRateLimit(req, { limit: 5, windowMs: 3600000, scope: "feedback-create" }, session.user.id);
    if (limited) return limited;
    const parsed = feedbackCreateSchema.safeParse(await feedbackJson(req));
    if (!parsed.success) throw new ApiError(parsed.error.errors[0].message, 42200, 422);
    const post = await postFor((await ctx.params).slug);
    return privateOk(await submitFeedback(post.id, session.user.id, parsed.data));
  } catch (e) { return feedbackFail(e); }
}
