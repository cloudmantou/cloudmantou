import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-error";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireAdminAndAudit: vi.fn(),
  requireAuth: vi.fn(),
  auditAdminAction: vi.fn(),
  checkRateLimit: vi.fn(),
  resolveReaderSpeechService: vi.fn(),
  resolveReaderSpeechTest: vi.fn(),
  saveReaderSpeechSettings: vi.fn(),
  getReaderSpeechSettings: vi.fn(),
  suggestReaderRoles: vi.fn(),
  synthesizeReaderSpeech: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({
  requireAdmin: mocks.requireAdmin,
  requireAdminAndAudit: mocks.requireAdminAndAudit,
  requireAuth: mocks.requireAuth,
}));
vi.mock("@/lib/admin-audit-log", () => ({ auditAdminAction: mocks.auditAdminAction }));
vi.mock("@/lib/rate-limit-server", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/reader-speech/settings", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/reader-speech/settings")>(),
  getReaderSpeechSettings: mocks.getReaderSpeechSettings,
  saveReaderSpeechSettings: mocks.saveReaderSpeechSettings,
  resolveReaderSpeechTest: mocks.resolveReaderSpeechTest,
  resolveReaderSpeechService: mocks.resolveReaderSpeechService,
}));
vi.mock("@/lib/reader-speech/mimo", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/reader-speech/mimo")>(),
  suggestReaderRoles: mocks.suggestReaderRoles,
  synthesizeReaderSpeech: mocks.synthesizeReaderSpeech,
}));

import { GET as adminSettings, PUT } from "@/app/api/admin/settings/reader-speech/route";
import { POST as adminTest } from "@/app/api/admin/settings/reader-speech/test/route";
import { GET as capabilities } from "@/app/api/reader/speech/route";
import { POST as officialSpeech } from "@/app/api/reader/speech/[service]/route";

const roleSettings = { service: "roles", enabled: true, model: "mimo-v2.6-flash", dailyLimit: 100 } as const;
const voiceSettings = { service: "tts", enabled: true, model: "mimo-v2.5-tts", voice: "苏打", dailyLimit: 1_000 } as const;
const fallback = new Uint8Array([0x49, 0x44, 0x33]);

function request(method: string, path: string, data: unknown) {
  return new NextRequest("https://cloudmantoua.top" + path, {
    method, body: JSON.stringify(data), headers: { "content-type": "application/json" },
  });
}

describe("reader speech routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    for (const authorize of [mocks.requireAdmin, mocks.requireAdminAndAudit, mocks.requireAuth]) {
      authorize.mockResolvedValue({ user: { id: "reader-fixture" } });
    }
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.getReaderSpeechSettings.mockResolvedValue([
      { ...roleSettings, keyConfigured: false }, { ...voiceSettings, keyConfigured: true },
    ]);
    mocks.resolveReaderSpeechService.mockResolvedValue({ ...voiceSettings, apiKey: "sk-tts-fixture" });
    mocks.synthesizeReaderSpeech.mockResolvedValue(fallback);
  });

  it("requires admin access to read or edit provider settings", async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiError("无权限", 40300, 403));
    expect((await adminSettings()).status).toBe(403);
    expect((await PUT(request("PUT", "/api/admin/settings/reader-speech", {}))).status).toBe(403);
    expect(mocks.getReaderSpeechSettings).not.toHaveBeenCalled();
    expect(mocks.saveReaderSpeechSettings).not.toHaveBeenCalled();
  });

  it("tests the selected draft without persisting the submitted provider key", async () => {
    const draft = { ...voiceSettings, apiKey: "sk-draft-fixture", clearApiKey: false };
    mocks.resolveReaderSpeechTest.mockResolvedValue(draft);
    const response = await adminTest(request("POST", "/api/admin/settings/reader-speech/test", draft));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { connected: true, service: "tts" } });
    expect(mocks.resolveReaderSpeechTest).toHaveBeenCalledWith(draft);
    expect(mocks.saveReaderSpeechSettings).not.toHaveBeenCalled();
  });

  it("authenticates, rate limits, and returns the configured service's audio", async () => {
    const call = () => officialSpeech(
      request("POST", "/api/reader/speech/tts", { text: "短句" }),
      { params: Promise.resolve({ service: "tts" }) },
    );
    mocks.requireAuth.mockRejectedValueOnce(new ApiError("请先登录", 40100, 401));
    expect((await call()).status).toBe(401);
    const limited = new Response("", { status: 429 });
    mocks.checkRateLimit.mockResolvedValueOnce(null).mockResolvedValueOnce(limited);
    expect(await call()).toBe(limited);
    expect(mocks.synthesizeReaderSpeech).not.toHaveBeenCalled();
    const audio = await call();
    expect(audio.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(fallback);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.anything(), { scope: "reader-speech-tts-daily", limit: 1_000, windowMs: 86_400_000 }, "site-wide",
    );
  });

  it("publishes only types, usable state and voice metadata", async () => {
    const response = await capabilities();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const { data } = await response.json();
    expect(data[0]).toEqual({ service: "roles", available: false, model: "mimo-v2.6-flash" });
    expect(data[1]).toMatchObject({ service: "tts", available: true, voice: "苏打" });
    expect(data[1]).not.toHaveProperty("apiKey");
    expect(data[1]).not.toHaveProperty("dailyLimit");
  });
});
