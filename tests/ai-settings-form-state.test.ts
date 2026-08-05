import { describe, expect, it } from "vitest";
import {
  beginDatabaseEditing,
  editAiSettings,
  type AiSettingsFormState,
} from "@/lib/ai/admin-form-state";

const environmentSettings: AiSettingsFormState = {
  mode: "environment",
  enabled: true,
  preset: "minimax",
  providerType: "anthropic-compatible",
  providerName: "minimax",
  baseURL: "https://api.minimaxi.com/anthropic",
  apiKey: "",
  clearApiKey: false,
  textModel: "MiniMax-M3",
  supportsStructuredOutputs: true,
  requestTimeoutMs: 120_000,
  openAiAuthMode: "bearer",
  anthropicAuthMode: "auth-token",
  apiKeyConfigured: true,
  status: "ready",
};

describe("AI settings form editing", () => {
  it("switches environment settings to an editable database draft", () => {
    expect(beginDatabaseEditing(environmentSettings)).toMatchObject({
      mode: "database",
      apiKey: "",
      apiKeyConfigured: false,
      status: "incomplete",
    });
  });

  it("applies the first field edit while switching to database mode", () => {
    const next = editAiSettings(environmentSettings, { textModel: "MiniMax-M3-new" });

    expect(next).toMatchObject({
      mode: "database",
      textModel: "MiniMax-M3-new",
      apiKeyConfigured: false,
      status: "incomplete",
    });
    expect(environmentSettings.textModel).toBe("MiniMax-M3");
  });

  it("keeps an existing database key for ordinary edits and clears it for endpoint changes", () => {
    const databaseSettings = { ...environmentSettings, mode: "database" as const };

    expect(editAiSettings(databaseSettings, { textModel: "another-model" }))
      .toMatchObject({ apiKeyConfigured: true, status: "incomplete" });
    expect(editAiSettings(
      databaseSettings,
      { baseURL: "https://provider.example/v1" },
      { invalidateApiKey: true },
    )).toMatchObject({ apiKey: "", apiKeyConfigured: false, status: "incomplete" });
  });
});
