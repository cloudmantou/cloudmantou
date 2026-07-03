export type DetectedImageType = "jpeg" | "png" | "gif" | "webp";

const MIME_BY_TYPE: Record<DetectedImageType, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "gif";
  }

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

export function mimeFromDetectedType(type: DetectedImageType): string {
  return MIME_BY_TYPE[type];
}

export function isAllowedImageBuffer(buffer: Buffer): boolean {
  return detectImageType(buffer) !== null;
}