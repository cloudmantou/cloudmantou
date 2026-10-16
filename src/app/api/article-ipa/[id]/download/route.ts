import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPostAccess } from "@/lib/post-access";
import { fail } from "@/lib/api-response";
import { ipaStoragePath } from "@/lib/article-ipa-server";
import { parseIpaRange } from "@/lib/article-ipa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function download(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const release = await prisma.articleIpaRelease.findUnique({ where: { id }, include: { post: { include: { paidContent: true } } } });
  if (!release?.post || release.deletedAt) return fail("安装包不存在", 40400, 404);
  const post = release.post;
  const session = await auth();
  const admin = session?.user?.role === "ADMIN";
  if (post.status === "DRAFT" && !admin) return fail("安装包不存在", 40400, 404);
  if (post.status === "PAID_ONLY" && !admin) {
    const access = await getPostAccess(session?.user?.id || null, post.id, post.content, post.paidContent?.content || null, post.status);
    if (!access.hasAccess) return fail("请先解锁文章后下载", 40300, 403);
  }
  const absolute = ipaStoragePath(release.storageKey);
  const file = await stat(absolute).catch(() => null);
  if (!file?.isFile() || file.size !== release.bytes) return fail("安装包文件暂不可用", 40400, 404);
  const range = parseIpaRange(req.headers.get("range"), file.size);
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="app.ipa"; filename*=UTF-8''${encodeURIComponent(release.filename).replace(/'/g, "%27")}`,
    "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Cache-Control": "private, no-store",
    "ETag": `"${release.sha256}"`,
  });
  if (range === false) {
    headers.set("Content-Range", `bytes */${file.size}`);
    return new Response(null, { status: 416, headers });
  }
  // A mismatched If-Range means return the complete current representation.
  const selected = range && (!req.headers.get("if-range") || req.headers.get("if-range") === headers.get("etag")) ? range : null;
  const start = selected?.start ?? 0;
  const end = selected?.end ?? file.size - 1;
  headers.set("Content-Length", String(end - start + 1));
  if (selected) headers.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
  const stream = req.method === "HEAD" ? null : Readable.toWeb(createReadStream(absolute, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(stream, { status: selected ? 206 : 200, headers });
}
export const GET = download;
export const HEAD = download;
