import { z } from "zod";

const diagnostic = z.object({ stage: z.string().max(40).optional(), kind: z.string().max(40).optional(), upstreamStatus: z.number().int().optional() });
const event = z.object({ id: z.string().max(64), at: z.string().max(40), endpoint: z.enum(["prepare", "download"]), appId: z.string().max(20), appVerId: z.string().max(20), result: z.string().max(64), durationMs: z.number(), diagnostic });
const status = z.object({
  recovery: z.object({ id: z.string().max(64).optional(), running: z.boolean(), startedAt: z.string().max(40).optional(), finishedAt: z.string().max(40).optional(), result: z.string().max(64).optional(), diagnostic }).optional(),
  profile: z.enum(["cn", "us"]), busy: z.string().max(20).optional(),
  auth: z.object({ locked: z.boolean(), lockCode: z.string().max(64).optional(), failureCount: z.number(), lastSignIn: z.string().max(40).optional(), lastError: z.string().max(64).optional(), cooldownUntil: z.string().max(40).optional() }),
  artifacts: z.object({ count: z.number(), bytes: z.number(), maxBytes: z.number(), highWaterBytes: z.number(), lowWaterBytes: z.number(), evicted: z.number() }),
  requests: z.object({ startedAt: z.string().max(40), counts: z.record(z.string().max(100), z.number()), recent: z.array(event).max(100) }).optional(),
});
export type IPAToolStatus = z.infer<typeof status>;
export type RegionStatus = { region: "cn" | "us"; sampledAt: string; reachable: boolean; data?: IPAToolStatus; error?: string };

// Fixed loopback destinations. Neither query parameters nor stored admin values
// can turn this endpoint into an SSRF proxy. Redirects are never followed.
export async function readIPAToolStatus(fetcher: typeof fetch = fetch): Promise<RegionStatus[]> {
  return Promise.all((["cn", "us"] as const).map(async region => {
    const sampledAt = new Date().toISOString();
    try {
      const response = await fetcher(`http://127.0.0.1:${region === "cn" ? 18092 : 18091}/api/status`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error("unavailable");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("empty");
      const chunks: Uint8Array[] = []; let bytes = 0;
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > 256 * 1024) throw new Error("oversized");
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const data = status.parse(payload.data);
      if (payload.success !== true || data.profile !== region) throw new Error("profile mismatch");
      return { region, sampledAt, reachable: true, data };
    } catch {
      return { region, sampledAt, reachable: false, error: "状态接口不可达或返回无效，请检查对应地区服务" };
    }
  }));
}

