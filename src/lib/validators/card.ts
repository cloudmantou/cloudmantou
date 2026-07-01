import { z } from "zod";

export const cardVerifySchema = z.object({
  cardNo: z.string().trim().min(4).max(64),
  cardSecret: z.string().trim().min(4).max(128)
});

export type CardVerifyInput = z.infer<typeof cardVerifySchema>;
