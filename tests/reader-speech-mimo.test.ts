import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchMiMo: vi.fn() }));
vi.mock("@/lib/ai/safe-fetch-server", () => ({ createSafeAiFetch: () => mocks.fetchMiMo }));

import { rolesInput, suggestReaderRoles, synthesizeReaderSpeech } from "@/lib/reader-speech/mimo";

const roles = { service: "roles", model: "mimo-v2.6-flash", apiKey: "sk-roles-fixture", enabled: true, dailyLimit: 90 } as const;
const tts = { service: "tts", model: "mimo-v2.5-tts", voice: "苏打", apiKey: "sk-tts-fixture", enabled: true, dailyLimit: 900 } as const;
const input = {
  chapter: "范進道：「謝謝。」",
  dialogues: [{ id: 12, text: "「謝謝。」" }],
  knownSpeakers: ["范進"],
};
const signal = new AbortController().signal;

function completion(message: unknown) {
  return Response.json({ choices: [{ message }] });
}

describe("MiMo reader speech requests", () => {
  beforeEach(() => mocks.fetchMiMo.mockReset());

  it("sends the requested dialogues and returns only validated candidate identities", async () => {
    const result = { assignments: [{ id: 12, candidates: [
      { speaker: "范進", gender: "unknown", age: "unknown", confidence: 0.91 },
    ] }] };
    mocks.fetchMiMo.mockResolvedValueOnce(completion({ content: JSON.stringify(result), audio: null }));
    expect(await suggestReaderRoles(roles, input, signal)).toEqual(result);
    const [url, request] = mocks.fetchMiMo.mock.calls[0];
    expect(url).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(request.headers["api-key"]).toBe(roles.apiKey);
    expect(JSON.parse(request.body)).toMatchObject({
      model: roles.model,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      messages: [{ role: "system" }, { role: "user", content: JSON.stringify(input) }],
    });
  });

  it("rejects duplicate input IDs and provider responses for different dialogue IDs", async () => {
    expect(rolesInput.safeParse({ ...input, dialogues: [...input.dialogues, ...input.dialogues] }).success).toBe(false);
    mocks.fetchMiMo.mockResolvedValueOnce(completion({
      content: JSON.stringify({ assignments: [{ id: 7, candidates: [] }] }),
    }));
    await expect(suggestReaderRoles(roles, input, signal)).rejects.toMatchObject({ status: 502, code: 50212 });
  });

  it("decodes MP3 and sends the requested voice using only the TTS key", async () => {
    const audio = Uint8Array.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]);
    mocks.fetchMiMo.mockResolvedValueOnce(completion({ audio: { data: Buffer.from(audio).toString("base64") } }));
    expect(await synthesizeReaderSpeech(tts, { text: "你好", voice: "冰糖" }, signal)).toEqual(audio);
    const [, request] = mocks.fetchMiMo.mock.calls[0];
    expect(request.headers["api-key"]).toBe(tts.apiKey);
    expect(JSON.parse(request.body)).toMatchObject({
      model: tts.model, audio: { format: "mp3", voice: "冰糖" }, messages: [{ role: "assistant", content: "你好" }],
    });
  });

  it("keeps upstream error bodies out of the client error", async () => {
    mocks.fetchMiMo.mockResolvedValueOnce(new Response("upstream detail", { status: 401 }));
    await expect(synthesizeReaderSpeech(tts, { text: "你好" }, signal))
      .rejects.toMatchObject({ status: 502, message: "MiMo 服务返回 HTTP 401" });
  });
});
