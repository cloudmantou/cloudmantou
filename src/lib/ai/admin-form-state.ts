import type { AdminAiSettings } from "@/lib/ai/settings-schema";

export type AiSettingsFormState = AdminAiSettings;

type EditOptions = {
  invalidateApiKey?: boolean;
};

function getDraftStatus(
  state: AiSettingsFormState,
): AiSettingsFormState["status"] {
  if (!state.enabled) return "disabled";
  return state.apiKey.trim() || state.apiKeyConfigured ? "ready" : "incomplete";
}

export function beginDatabaseEditing(
  state: AiSettingsFormState,
): AiSettingsFormState {
  if (state.mode === "database") return { ...state };
  return {
    ...state,
    mode: "database",
    apiKey: "",
    clearApiKey: false,
    apiKeyConfigured: false,
    status: state.enabled ? "incomplete" : "disabled",
  };
}

export function editAiSettings(
  state: AiSettingsFormState,
  patch: Partial<AiSettingsFormState>,
  options: EditOptions = {},
): AiSettingsFormState {
  const editable = beginDatabaseEditing(state);
  const next = {
    ...editable,
    ...patch,
    ...(options.invalidateApiKey
      ? { apiKey: "", clearApiKey: false, apiKeyConfigured: false }
      : {}),
  };
  return {
    ...next,
    status: getDraftStatus(next),
  };
}
