import { z } from "zod";

export const feedbackKinds = ["QUESTION", "BUG", "IDEA"] as const;
export const feedbackStatuses = ["SUBMITTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED"] as const;
export type FeedbackStatus = typeof feedbackStatuses[number];
export const feedbackStatusLabels: Record<FeedbackStatus, string> = { SUBMITTED: "待处理", ACCEPTED: "已采纳", IN_PROGRESS: "开发中", COMPLETED: "已完成", DECLINED: "暂不采纳" };
export const feedbackKindLabels = { QUESTION: "使用问题", BUG: "Bug 反馈", IDEA: "功能建议" };
export const feedbackCreateSchema = z.object({
  title: z.string().trim().min(3, "标题至少 3 字").max(150),
  content: z.string().trim().min(5, "请补充问题描述或复现步骤").max(5000),
  kind: z.enum(feedbackKinds),
  appVersion: z.string().trim().max(64).default(""),
  environment: z.string().trim().max(300).default(""),
  imageIds: z.array(z.string().cuid()).max(3).default([]).refine(ids => new Set(ids).size === ids.length, "截图不能重复"),
  allowPublic: z.boolean().default(true),
}).strict();
export const feedbackUpdateSchema = z.object({
  status: z.enum(feedbackStatuses),
  note: z.string().trim().max(3000).default(""),
  resolvedVersion: z.string().trim().max(64).default(""),
  published: z.boolean(),
}).strict();
export const feedbackPolicySchema = z.object({ accepted: z.number().int().min(0).max(10000), completed: z.number().int().min(0).max(10000) }).strict();
export const defaultFeedbackPolicy = { accepted: 10, completed: 40 };
export function rewardStages(status: FeedbackStatus) {
  return status === "COMPLETED" ? ["accepted", "completed"] as const : ["ACCEPTED", "IN_PROGRESS"].includes(status) ? ["accepted"] as const : [];
}
export function canTransition(from: FeedbackStatus, to: FeedbackStatus) {
  if (from === to) return true;
  const allowed: Record<FeedbackStatus, FeedbackStatus[]> = {
    SUBMITTED: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED"],
    ACCEPTED: ["IN_PROGRESS", "COMPLETED", "DECLINED"],
    IN_PROGRESS: ["COMPLETED", "DECLINED"],
    COMPLETED: ["IN_PROGRESS"],
    DECLINED: ["SUBMITTED", "ACCEPTED"],
  };
  return allowed[from].includes(to);
}
export type FeedbackItem = {
  id: string; title: string; content: string; kind: typeof feedbackKinds[number]; status: FeedbackStatus;
  appVersion: string | null; environment: string | null; resolvedVersion: string | null;
  published: boolean; allowPublic: boolean; createdAt: string;
  user: { id: string; nickname: string | null; username: string };
  post?: { title: string; slug: string };
  images: { id: string }[];
  events: { id: string; status: FeedbackStatus; note: string; awardedPoints: number; createdAt: string }[];
};
