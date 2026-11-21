import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchMiMo: vi.fn() }));
vi.mock("@/lib/ai/safe-fetch-server", () => ({ createSafeAiFetch: () => mocks.fetchMiMo }));

import { rolesInput, suggestReaderRoles, synthesizeReaderSpeech } from "@/lib/reader-speech/upstream";
import { MIMO_API_BASE_URL } from "@/lib/ai/mimo-config";
import { ROLE_PRESETS, TTS_PRESETS } from "@/lib/reader-speech/config";

const roles = {
  service: "roles", provider: "mimo", authMode: "api-key", model: "mimo-v2.6-flash",
  baseURL: MIMO_API_BASE_URL, apiKey: "sk-roles-fixture", enabled: true, dailyLimit: 90,
} as const;
const tts = {
  service: "tts", provider: "mimo", authMode: "api-key", model: "mimo-v2.5-tts",
  baseURL: MIMO_API_BASE_URL, voice: "苏打", apiKey: "sk-tts-fixture", enabled: true, dailyLimit: 900,
  additionalVoices: [] as string[],
} as const;
const input = {
  chapter: "范進道：「謝謝。」",
  dialogues: [{ id: 12, text: "「謝謝。」" }],
  knownSpeakers: ["范進"],
};
const signal = new AbortController().signal;

function completion(message: unknown) {
  return Response.json({ choices: [{ message }] });
}

describe("reader speech provider requests", () => {
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
      .rejects.toMatchObject({ status: 502, message: "小米 MiMo 服务返回 HTTP 401" });
  });

  it("uses each configured gateway URL with its own bearer credential", async () => {
    const rolesEndpoint = { ...roles, authMode: "bearer" as const, baseURL: "https://roles.example.com/v1", apiKey: "roles-gateway-key" };
    const ttsEndpoint = { ...tts, authMode: "bearer" as const, baseURL: "https://tts.example.com/mi/v1", apiKey: "tts-gateway-key" };
    mocks.fetchMiMo
      .mockResolvedValueOnce(completion({ content: JSON.stringify({ assignments: [{ id: 12, candidates: [] }] }) }))
      .mockResolvedValueOnce(completion({ audio: { data: "SUQz" } }));

    await suggestReaderRoles(rolesEndpoint, input, signal);
    await synthesizeReaderSpeech(ttsEndpoint, { text: "你好" }, signal);
    for (const [index, config] of [rolesEndpoint, ttsEndpoint].entries()) {
      const [url, request] = mocks.fetchMiMo.mock.calls[index];
      expect(url).toBe(config.baseURL + "/chat/completions");
      expect(request.headers.Authorization).toBe("Bearer " + config.apiKey);
      expect(request.headers).not.toHaveProperty("api-key");
    }
  });

  it("uses the DeepSeek chat and MiniMax Messages protocols for the same role data", async () => {
    const result = { assignments: [{ id: 12, candidates: [] }] };
    const text = JSON.stringify(result);
    mocks.fetchMiMo
      .mockResolvedValueOnce(completion({ content: text }))
      .mockResolvedValueOnce(Response.json({ content: [
        { type: "thinking", thinking: "reasoning" },
        { type: "text", text: "```json\n" + text + "\n```" },
      ] }));
    expect(await suggestReaderRoles({ ...roles, ...ROLE_PRESETS.deepseek, provider: "deepseek" }, input, signal)).toEqual(result);
    expect(await suggestReaderRoles({ ...roles, ...ROLE_PRESETS.minimax, provider: "minimax" }, input, signal)).toEqual(result);
    const [deepseekURL, chatRequest] = mocks.fetchMiMo.mock.calls[0];
    expect(deepseekURL).toBe("https://api.deepseek.com/chat/completions");
    expect(chatRequest.headers.Authorization).toBe("Bearer " + roles.apiKey);
    expect(JSON.parse(chatRequest.body)).toMatchObject({
      model: ROLE_PRESETS.deepseek.model, max_tokens: 16_000, thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    });
    const [miniMaxURL, messagesRequest] = mocks.fetchMiMo.mock.calls[1];
    expect(miniMaxURL).toBe("https://api.minimax.cn/anthropic/v1/messages");
    expect(messagesRequest.headers["anthropic-version"]).toBe("2023-06-01");
    expect(messagesRequest.headers["x-api-key"]).toBe(roles.apiKey);
    expect(JSON.parse(messagesRequest.body)).toMatchObject({
      model: ROLE_PRESETS.minimax.model, system: expect.any(String),
      messages: [{ role: "user", content: [{ type: "text", text: JSON.stringify(input) }] }],
      output_config: { effort: "low" },
    });
  });

  it("reads native MiniMax hex and SiliconFlow binary speech and sends the selected voice", async () => {
    const audio = Uint8Array.from([0x49, 0x44, 0x33, 0x04, 0x03, 0x00]);
    mocks.fetchMiMo
      .mockResolvedValueOnce(Response.json({ base_resp: { status_code: 0 }, data: { audio: Buffer.from(audio).toString("hex") } }))
      .mockResolvedValueOnce(new Response(audio, { headers: { "Content-Type": "audio/mpeg" } }));
    expect(await synthesizeReaderSpeech({ ...tts, ...TTS_PRESETS.minimax, provider: "minimax" }, { text: "你好" }, signal)).toEqual(audio);
    const voice = TTS_PRESETS.siliconflow.voices[1];
    expect(await synthesizeReaderSpeech({ ...tts, ...TTS_PRESETS.siliconflow, provider: "siliconflow" }, { text: "你好", voice }, signal)).toEqual(audio);
    const [miniMaxURL, miniMaxRequest] = mocks.fetchMiMo.mock.calls[0];
    expect(miniMaxURL).toBe("https://api.minimax.cn/v1/t2a_v2");
    expect(JSON.parse(miniMaxRequest.body)).toMatchObject({
      text: "你好", stream: false, model: "speech-2.8-hd", output_format: "hex",
      voice_setting: { voice_id: "male-qn-qingse" }, audio_setting: { format: "mp3" },
    });
    const [siliconFlowURL, siliconFlowRequest] = mocks.fetchMiMo.mock.calls[1];
    expect(siliconFlowURL).toBe("https://api.siliconflow.cn/v1/audio/speech");
    expect(JSON.parse(siliconFlowRequest.body)).toMatchObject({
      input: "你好", model: TTS_PRESETS.siliconflow.model, voice, response_format: "mp3",
    });
  });

  it("rejects a voice outside the configured catalog and a JSON error masquerading as audio", async () => {
    const config = {
      ...tts, provider: "custom-openai" as const, baseURL: "https://tts.example.com/api",
      authMode: "x-api-key" as const, model: "custom-tts", voice: "narrator", additionalVoices: ["character"],
    };
    await expect(synthesizeReaderSpeech(config, { text: "你好", voice: "苏打" }, signal)).rejects.toMatchObject({ status: 422 });
    expect(mocks.fetchMiMo).not.toHaveBeenCalled();
    mocks.fetchMiMo.mockResolvedValueOnce(Response.json({ error: "upstream details" }));
    await expect(synthesizeReaderSpeech(config, { text: "你好", voice: "character" }, signal))
      .rejects.toMatchObject({ status: 502, code: 50213 });
    expect(mocks.fetchMiMo.mock.calls[0][1].headers["x-api-key"]).toBe(config.apiKey);
  });
});
