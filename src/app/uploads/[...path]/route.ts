import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUploadRoot } from "@/lib/local-storage";

export const runtime = "nodejs";

const UPLOAD_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const IMAGE_CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

function isInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const segments = (await context.params).path;
  if (!segments?.length || segments.some((segment) => !UPLOAD_SEGMENT.test(segment))) {
    return notFound();
  }

  const contentType = IMAGE_CONTENT_TYPES[path.extname(segments.at(-1)!).toLowerCase()];
  if (!contentType) return notFound();

  try {
    const root = await realpath(getUploadRoot());
    const candidate = await realpath(path.join(root, ...segments));
    if (!isInsideRoot(root, candidate)) return notFound();

    const fileStat = await stat(candidate);
    if (!fileStat.isFile()) return notFound();
    const body = await readFile(candidate);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=2592000, immutable",
        "Content-Length": String(body.length),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
