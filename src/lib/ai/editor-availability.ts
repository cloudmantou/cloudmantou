export type AiAvailabilityState = "ready" | "needs-setup" | "unavailable";

export type AiAvailability = {
  state: AiAvailabilityState;
  message: string;
};

const CONFIGURATION_STATUSES = new Set(["disabled", "incomplete", "invalid"]);

function readConfigurationStatus(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = body.data;
  if (!data || typeof data !== "object" || !("status" in data)) return null;
  return typeof data.status === "string" ? data.status : null;
}

export function classifyAiAvailability(
  httpStatus: number,
  body: unknown,
): AiAvailability {
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      state: "unavailable",
      message: "管理员登录状态已失效，请重新登录",
    };
  }

  if (httpStatus < 200 || httpStatus >= 300) {
    return {
      state: "unavailable",
      message: "AI 配置状态检查失败，请刷新页面后重试",
    };
  }

  const status = readConfigurationStatus(body);
  if (status === "ready") return { state: "ready", message: "" };
  if (status && CONFIGURATION_STATUSES.has(status)) {
    return { state: "needs-setup", message: "AI 模型尚未配置" };
  }
  return {
    state: "unavailable",
    message: "AI 配置状态检查失败，请刷新页面后重试",
  };
}
