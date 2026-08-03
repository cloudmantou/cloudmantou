export type ClientApiEnvelope = Record<string, unknown> & {
  code: number;
  data: unknown;
  message: string;
};

function isApiEnvelope(value: unknown): value is ClientApiEnvelope {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).code === "number"
    && typeof (value as Record<string, unknown>).message === "string"
    && Object.prototype.hasOwnProperty.call(value, "data");
}

export async function readApiEnvelope(
  response: Response,
  fallbackMessage: string,
  preferServerMessage = true
): Promise<ClientApiEnvelope> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!isApiEnvelope(payload)) {
    throw new Error(fallbackMessage);
  }

  if (!response.ok || payload.code !== 0) {
    const serverMessage = preferServerMessage && payload.message.trim()
      ? payload.message
      : fallbackMessage;
    throw new Error(serverMessage);
  }

  return payload;
}
