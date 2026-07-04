import type { CommentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export async function countApprovedPostComments(postId: string, tx: Tx = prisma): Promise<number> {
  return tx.comment.count({
    where: { postId, status: "APPROVED" },
  });
}

/** 用真实 approved 评论数覆盖 posts.commentCount */
export async function reconcilePostCommentCount(postId: string, tx: Tx = prisma): Promise<number> {
  const count = await countApprovedPostComments(postId, tx);
  await tx.post.update({
    where: { id: postId },
    data: { commentCount: count },
  });
  return count;
}

export function commentCountDelta(
  previousStatus: CommentStatus,
  nextStatus: CommentStatus
): number {
  const wasApproved = previousStatus === "APPROVED";
  const isApproved = nextStatus === "APPROVED";
  if (!wasApproved && isApproved) return 1;
  if (wasApproved && !isApproved) return -1;
  return 0;
}

export async function applyPostCommentCountDelta(
  tx: Tx,
  postId: string,
  delta: number
): Promise<void> {
  if (delta === 0) return;
  if (delta > 0) {
    await tx.post.update({
      where: { id: postId },
      data: { commentCount: { increment: delta } },
    });
    return;
  }
  await tx.post.update({
    where: { id: postId },
    data: { commentCount: { decrement: Math.abs(delta) } },
  });
}

export async function onCommentStatusChange(
  tx: Tx,
  postId: string,
  previousStatus: CommentStatus,
  nextStatus: CommentStatus
): Promise<void> {
  await applyPostCommentCountDelta(tx, postId, commentCountDelta(previousStatus, nextStatus));
}

export async function onCommentDeleted(
  tx: Tx,
  postId: string,
  status: CommentStatus
): Promise<void> {
  if (status === "APPROVED") {
    await applyPostCommentCountDelta(tx, postId, -1);
  }
}