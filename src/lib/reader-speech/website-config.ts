import { MIMO_API_BASE_URL } from "@/lib/ai/mimo-config";
import { ApiError } from "@/lib/api-error";
import { MIMO_ROLE_MODELS, MIMO_TTS_MODEL } from "@/lib/reader-speech/config";

function officialMiMoKey() {
  const apiKey = process.env.MTSK_OFFICIAL_MIMO_API_KEY?.trim();
  return apiKey && apiKey.length <= 2_048 && /^[\x21-\x7e]+$/.test(apiKey) ? apiKey : undefined;
}

export function getOfficialMiMoAccess() {
  const apiKey = officialMiMoKey();
  if (!apiKey) throw new ApiError("官方模型调用配置暂不可用", 50317, 503);
  return { baseURL: MIMO_API_BASE_URL, apiKey };
}

export function officialMiMoCatalog() {
  const [rolesModel] = MIMO_ROLE_MODELS;
  const ttsModel = MIMO_TTS_MODEL;
  const endpoint = MIMO_API_BASE_URL + "/chat/completions";
  return {
    rolesEndpoint: endpoint,
    ttsEndpoint: endpoint,
    rolesModel,
    ttsModel,
    catalog: {
      version: 1,
      displayName: "官方模型",
      officialServiceEnabled: Boolean(officialMiMoKey() && process.env.MTSK_APP_ATTEST_TEAM_ID?.trim()),
      models: { speakerRecognition: [rolesModel], speechSynthesis: ttsModel },
      defaultVoice: "冰糖",
      voices: [
        { id: "冰糖", language: "zh", gender: "female", castingHint: "温柔，吐字清晰自然" },
        { id: "茉莉", language: "zh", gender: "female", castingHint: "知性，柔和温暖" },
        { id: "苏打", language: "zh", gender: "male", castingHint: "元气，活力充沛" },
        { id: "白桦", language: "zh", gender: "male", castingHint: "沉稳，声线厚重" },
      ],
    },
  };
}
