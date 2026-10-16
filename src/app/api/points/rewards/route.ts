import { listPointRewards } from "@/lib/feedback-server";
import { privateOk, feedbackFail } from "@/lib/feedback-request";
export const dynamic = "force-dynamic";
export async function GET() { try { return privateOk(await listPointRewards()); } catch (e) { return feedbackFail(e); } }
