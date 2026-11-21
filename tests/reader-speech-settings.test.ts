import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rows: new Map<string, string>(),
  findUnique: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { siteSetting: { findUnique: db.findUnique, create: db.create, updateMany: db.updateMany } },
}));
vi.mock("@/lib/secret-crypto", () => ({
  isEncryptedSecret: (value: string) => value.startsWith("test-cipher:"),
  encryptSecret: (value: string) => "test-cipher:" + Buffer.from(value).toString("base64"),
  decryptSecret: (value: string) => Buffer.from(value.slice("test-cipher:".length), "base64").toString(),
}));

import {
  getReaderSpeechSettings, readerSpeechSettingsInput, resolveReaderSpeechService,
  resolveReaderSpeechTest, saveReaderSpeechSettings,
} from "@/lib/reader-speech/settings";
import { MIMO_API_BASE_URL } from "@/lib/ai/mimo-config";

const roles = {
  service: "roles", enabled: true, model: "mimo-v2.6-flash", dailyLimit: 90, apiKey: "sk-roles-fixture", clearApiKey: false,
} as const;
const tts = {
  service: "tts", enabled: true, model: "mimo-v2.5-tts", voice: "苏打", dailyLimit: 900, apiKey: "sk-tts-fixture", clearApiKey: false,
} as const;

describe("reader speech settings", () => {
  beforeEach(() => {
    db.rows.clear();
    vi.resetAllMocks();
    db.findUnique.mockImplementation(({ where }) => {
      const value = db.rows.get(where.key);
      return Promise.resolve(value ? { value } : null);
    });
    db.create.mockImplementation(({ data }) => {
      db.rows.set(data.key, data.value);
      return Promise.resolve({});
    });
    db.updateMany.mockImplementation(({ where, data }) => {
      if (db.rows.get(where.key) !== where.value) return Promise.resolve({ count: 0 });
      db.rows.set(where.key, data.value);
      return Promise.resolve({ count: 1 });
    });
  });

  it("persists two separate encrypted keys and returns only their configured state", async () => {
    expect(await getReaderSpeechSettings()).toMatchObject([
      { service: "roles", baseURL: MIMO_API_BASE_URL, enabled: false, keyConfigured: false },
      { service: "tts", baseURL: MIMO_API_BASE_URL, enabled: false, keyConfigured: false, voice: "苏打" },
    ]);
    await saveReaderSpeechSettings(roles);
    await saveReaderSpeechSettings(tts);
    await saveReaderSpeechSettings({ ...roles, model: "mimo-v2.6-pro", apiKey: "" });
    expect(await resolveReaderSpeechService("roles")).toMatchObject({ baseURL: MIMO_API_BASE_URL, model: "mimo-v2.6-pro", apiKey: roles.apiKey });
    expect(await resolveReaderSpeechService("tts")).toMatchObject({ baseURL: MIMO_API_BASE_URL, voice: "苏打", apiKey: tts.apiKey });
    expect(await getReaderSpeechSettings()).toMatchObject([
      { service: "roles", model: "mimo-v2.6-pro", keyConfigured: true },
      { service: "tts", model: "mimo-v2.5-tts", keyConfigured: true },
    ]);
    const stored = [...db.rows.values()];
    expect(stored.every((row) => row.includes("test-cipher:") && !row.includes(roles.apiKey) && !row.includes(tts.apiKey))).toBe(true);
    expect(JSON.stringify(await getReaderSpeechSettings())).not.toContain("encryptedKey");
  });

  it("keeps URLs and gateway keys separate, including after later edits", async () => {
    const roleDraft = readerSpeechSettingsInput.parse({
      ...roles, baseURL: " https://roles.example.com/v1/chat/completions/ ", apiKey: "role-gateway-key",
    });
    const ttsDraft = readerSpeechSettingsInput.parse({
      ...tts, baseURL: "https://speech.example.com/api/v2/", apiKey: "tts-gateway-key",
    });
    await saveReaderSpeechSettings(roleDraft);
    await saveReaderSpeechSettings(ttsDraft);
    await saveReaderSpeechSettings({ ...roleDraft, apiKey: "", dailyLimit: 200 });
    expect(await getReaderSpeechSettings()).toMatchObject([
      { service: "roles", baseURL: "https://roles.example.com/v1", keyConfigured: true, dailyLimit: 200 },
      { service: "tts", baseURL: "https://speech.example.com/api/v2", keyConfigured: true, dailyLimit: 900 },
    ]);
    expect(await resolveReaderSpeechService("roles")).toMatchObject({ baseURL: roleDraft.baseURL, apiKey: roleDraft.apiKey });
    expect(await resolveReaderSpeechService("tts")).toMatchObject({ baseURL: ttsDraft.baseURL, apiKey: ttsDraft.apiKey });
    expect(await resolveReaderSpeechTest({ ...ttsDraft, apiKey: "" })).toMatchObject({ baseURL: ttsDraft.baseURL, apiKey: ttsDraft.apiKey });
  });

  it("never reuses a saved key when testing or saving a different endpoint", async () => {
    await saveReaderSpeechSettings(roles);
    const newEndpoint = readerSpeechSettingsInput.parse({ ...roles, apiKey: "", baseURL: "https://roles.example.com/v1" });
    await expect(resolveReaderSpeechTest(newEndpoint)).rejects.toMatchObject({ status: 422, code: 42211 });
    await expect(saveReaderSpeechSettings({ ...newEndpoint, enabled: false })).rejects.toMatchObject({ status: 422, code: 42211 });
    await expect(saveReaderSpeechSettings({ ...newEndpoint, apiKey: "test-cipher:fixture" })).rejects.toMatchObject({ status: 422 });
    await expect(resolveReaderSpeechTest({ ...newEndpoint, apiKey: "new-gateway-key" })).resolves.toMatchObject({
      baseURL: newEndpoint.baseURL, apiKey: "new-gateway-key",
    });
    expect(await resolveReaderSpeechService("roles")).toMatchObject({ baseURL: MIMO_API_BASE_URL, apiKey: roles.apiKey });
    await saveReaderSpeechSettings({ ...newEndpoint, apiKey: "new-gateway-key" });
    await expect(saveReaderSpeechSettings(roles)).rejects.toMatchObject({ status: 409 });
    await expect(resolveReaderSpeechTest(roles)).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    "http://roles.example.com/v1",
    "https://localhost/v1",
    "https://localhost./v1",
    "https://192.168.0.10/v1",
    "https://account@roles.example.com/v1",
    "https://roles.example.com/v1?token=example",
    "https://token-plan-cn.xiaomimimo.com/v1",
  ])("rejects an unsupported endpoint %s", (baseURL) => {
    expect(readerSpeechSettingsInput.safeParse({ ...roles, baseURL }).success).toBe(false);
  });

  it("blocks Token Plan keys, unknown voice IDs and attempts to enable a keyless service", async () => {
    for (const apiKey of ["tp-fixture", "ttp-fixture"]) {
      const result = readerSpeechSettingsInput.safeParse({ ...roles, apiKey });
      expect(result.error?.issues[0]?.message).toMatch(/Token Plan.*按量付费/);
    }
    expect(readerSpeechSettingsInput.parse({ ...roles, apiKey: " " + roles.apiKey + "\n" }).apiKey).toBe(roles.apiKey);
    expect(readerSpeechSettingsInput.safeParse({ ...tts, voice: "arbitrary" }).success).toBe(false);
    await expect(saveReaderSpeechSettings({ ...roles, apiKey: "" })).rejects.toMatchObject({ status: 422 });
    expect(db.create).not.toHaveBeenCalled();
  });

  it("tests a draft without storing it and refuses to reuse a different service's key", async () => {
    await saveReaderSpeechSettings(tts);
    await expect(resolveReaderSpeechTest({ ...roles, apiKey: "" })).rejects.toMatchObject({ status: 503 });
    expect(await resolveReaderSpeechTest(roles)).toMatchObject({ apiKey: roles.apiKey });
    expect(db.rows.has("readerSpeechRoles")).toBe(false);
    await saveReaderSpeechSettings({ ...tts, enabled: false, clearApiKey: true, apiKey: "" });
    await expect(resolveReaderSpeechService("tts")).rejects.toMatchObject({ status: 503 });
    expect((await getReaderSpeechSettings())[1]).toMatchObject({ enabled: false, keyConfigured: false });
  });

  it("rejects a concurrent replacement so a stale write cannot restore a rotated key", async () => {
    await saveReaderSpeechSettings(roles);
    db.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(saveReaderSpeechSettings({ ...roles, apiKey: "" })).rejects.toMatchObject({ status: 409 });
  });
});
