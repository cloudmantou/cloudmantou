import path from "path";
import { mkdir, writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/guards";
import { processUploadImage } from "@/lib/image-process-server";
import { lockPointsUser } from "@/lib/feedback-server";
export const FEEDBACK_IMAGE_LIMIT = 4 * 1024 * 1024;
export function feedbackImagePath(storageKey: string) {
  if (!/^[a-f0-9-]{36}\.webp$/.test(storageKey)) throw new Error("Invalid screenshot storage key");
  const configured = process.env.FEEDBACK_UPLOAD_DIR?.trim();
  if (process.env.NODE_ENV === "production" && (!configured || !path.isAbsolute(configured))) throw new Error("FEEDBACK_UPLOAD_DIR must be a persistent absolute directory");
  return path.join(configured || path.resolve(".data/feedback-images"), storageKey);
}
export async function uploadFeedbackImage(userId: string, input: Buffer) {
  if (!input.length || input.length > FEEDBACK_IMAGE_LIMIT) throw new ApiError("截图不能超过 4 MB", 41300, 413);
  const expired = await prisma.$transaction(async tx => {
    await lockPointsUser(tx, userId);
    const old = await tx.feedbackImage.findMany({ where: { uploadedBy: userId, feedbackId: null, createdAt: { lt: new Date(Date.now() - 86400000) } }, take: 100 });
    if (old.length) await tx.feedbackImage.deleteMany({ where: { id: { in: old.map(i => i.id) }, uploadedBy: userId, feedbackId: null } });
    return old;
  });
  for (const image of expired) await unlink(feedbackImagePath(image.storageKey)).catch(() => {});
  const processed = await processUploadImage(input, "content");
  const storageKey = randomUUID() + ".webp"; const filename = feedbackImagePath(storageKey);
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  let written = false;
  try {
    return await prisma.$transaction(async tx => {
      await lockPointsUser(tx, userId);
      if (await tx.feedbackImage.count({ where: { uploadedBy: userId, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= 15) throw new ApiError("每天最多上传 15 张截图", 42900, 429);
      await writeFile(filename, processed.buffer, { flag: "wx", mode: 0o600 }); written = true;
      const image = await tx.feedbackImage.create({ data: { uploadedBy: userId, storageKey, bytes: processed.buffer.length } });
      return { id: image.id, url: `/api/feedback/images/${image.id}`, bytes: image.bytes };
    });
  } catch (e) { if (written) await unlink(filename).catch(() => {}); throw e; }
}
