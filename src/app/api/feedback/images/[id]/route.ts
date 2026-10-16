import { readFile } from "fs/promises";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feedbackImagePath } from "@/lib/feedback-images";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), ctx.params]);
  const image = await prisma.feedbackImage.findUnique({ where: { id }, include: { feedback: { include: { post: { select: { status: true } } } } } });
  const publicImage = image?.feedback?.published && image.feedback.allowPublic && image.feedback.post.status !== "DRAFT";
  if (!image || (!publicImage && session?.user?.id !== image.uploadedBy && session?.user?.role !== "ADMIN")) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  try {
    const buffer = await readFile(feedbackImagePath(image.storageKey));
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Length": String(buffer.length) } });
  } catch { return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } }); }
}
