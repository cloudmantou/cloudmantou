import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    feedbackImage: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) },
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    processUploadImage: vi.fn(),
  };
});

vi.mock("fs/promises", () => ({ mkdir: mocks.mkdir, writeFile: mocks.writeFile, unlink: mocks.unlink }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/image-process-server", () => ({ processUploadImage: mocks.processUploadImage }));
vi.mock("@/lib/card-delivery", () => ({ deliverCardPackageOrder: vi.fn() }));

import { ApiError } from "@/lib/guards";
import { FEEDBACK_IMAGE_LIMIT, feedbackImagePath, uploadFeedbackImage } from "@/lib/feedback-images";

const key = "0123abcd-0123-4567-89ab-0123456789ab.webp";
const { tx } = mocks;

describe("feedback screenshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FEEDBACK_UPLOAD_DIR", "/srv/feedback");
    tx.$queryRaw.mockResolvedValue([{ id: "u1", points: 0 }]);
    tx.feedbackImage.findMany.mockResolvedValue([]);
    tx.feedbackImage.count.mockResolvedValue(0);
    tx.feedbackImage.create.mockImplementation(async ({ data }: { data: { bytes: number } }) => ({ id: "img1", bytes: data.bytes }));
    mocks.processUploadImage.mockResolvedValue({ buffer: Buffer.from("webp") });
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.unlink.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  describe("feedbackImagePath", () => {
    it("rejects storage keys that could escape the directory", () => {
      expect(() => feedbackImagePath("../etc/passwd")).toThrow("Invalid screenshot storage key");
    });

    it("uses the configured directory, falling back to .data in development", () => {
      expect(feedbackImagePath(key)).toBe(path.join("/srv/feedback", key));
      vi.stubEnv("FEEDBACK_UPLOAD_DIR", "  ");
      expect(feedbackImagePath(key)).toBe(path.join(path.resolve(".data/feedback-images"), key));
    });

    it("requires a persistent absolute directory in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(feedbackImagePath(key)).toBe(path.join("/srv/feedback", key));
      vi.stubEnv("FEEDBACK_UPLOAD_DIR", "relative/dir");
      expect(() => feedbackImagePath(key)).toThrow("FEEDBACK_UPLOAD_DIR");
      vi.stubEnv("FEEDBACK_UPLOAD_DIR", "");
      expect(() => feedbackImagePath(key)).toThrow("FEEDBACK_UPLOAD_DIR");
    });
  });

  describe("uploadFeedbackImage", () => {
    it("rejects empty and oversized uploads before touching storage", async () => {
      await expect(uploadFeedbackImage("u1", Buffer.alloc(0))).rejects.toMatchObject({ status: 413 });
      await expect(uploadFeedbackImage("u1", Buffer.alloc(FEEDBACK_IMAGE_LIMIT + 1))).rejects.toMatchObject({ status: 413 });
      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });

    it("compresses, writes privately and records the screenshot", async () => {
      const result = await uploadFeedbackImage("u1", Buffer.from("png"));
      expect(result).toEqual({ id: "img1", url: "/api/feedback/images/img1", bytes: 4 });
      expect(mocks.processUploadImage).toHaveBeenCalledWith(Buffer.from("png"), "content");
      expect(mocks.mkdir).toHaveBeenCalledWith("/srv/feedback", { recursive: true, mode: 0o700 });
      expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringMatching(/^\/srv\/feedback\/[a-f0-9-]{36}\.webp$/), Buffer.from("webp"), { flag: "wx", mode: 0o600 });
      expect(tx.feedbackImage.deleteMany).not.toHaveBeenCalled();
    });

    it("purges this user's expired orphan screenshots, ignoring unlink failures", async () => {
      tx.feedbackImage.findMany.mockResolvedValueOnce([{ id: "old1", storageKey: key }]);
      mocks.unlink.mockRejectedValueOnce(new Error("ENOENT"));
      await uploadFeedbackImage("u1", Buffer.from("png"));
      expect(tx.feedbackImage.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["old1"] }, uploadedBy: "u1", feedbackId: null } });
      expect(mocks.unlink).toHaveBeenCalledWith(path.join("/srv/feedback", key));
    });

    it("enforces the daily quota without writing a file", async () => {
      tx.feedbackImage.count.mockResolvedValueOnce(15);
      const error = await uploadFeedbackImage("u1", Buffer.from("png")).catch(e => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(429);
      expect(mocks.writeFile).not.toHaveBeenCalled();
      expect(mocks.unlink).not.toHaveBeenCalled();
    });

    it("removes the written file when the database insert fails", async () => {
      tx.feedbackImage.create.mockRejectedValueOnce(new Error("db down"));
      mocks.unlink.mockRejectedValueOnce(new Error("busy"));
      await expect(uploadFeedbackImage("u1", Buffer.from("png"))).rejects.toThrow("db down");
      expect(mocks.unlink).toHaveBeenCalledWith(mocks.writeFile.mock.calls[0][0]);
    });
  });
});
