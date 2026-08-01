import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  findFirst: vi.fn(),
  headers: vi.fn(),
  nonce: null as string | null,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: boundary.findFirst } },
}));

vi.mock("next/headers", () => ({
  headers: boundary.headers,
}));

import { getCspNonce } from "@/lib/csp-nonce";
import { verifyCredentials } from "@/lib/credentials-auth";
import { isAllowedAdminMutationOrigin } from "@/lib/csrf-origin";
import { canComment, canPublishContent, isAdminRole } from "@/lib/roles";

const ENV_KEYS = [
  "AUTH_URL",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NODE_ENV",
  "TRUST_PROXY_HEADERS",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else Reflect.set(process.env, key, value);
  }
}

function request(headers: Record<string, string>) {
  return new NextRequest("https://admin.example.test/api/admin/settings", {
    method: "PUT",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.nonce = null;
  boundary.headers.mockImplementation(async () => ({
    get: (name: string) => (name.toLowerCase() === "x-nonce" ? boundary.nonce : null),
  }));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(restoreEnv);

describe("verifyCredentials", () => {
  it.each([
    ["", "password"],
    ["   ", "password"],
    ["alice", ""],
  ])("rejects missing credentials before querying Prisma", async (identifier, password) => {
    await expect(verifyCredentials(identifier, password)).resolves.toBeNull();
    expect(boundary.findFirst).not.toHaveBeenCalled();
  });

  it("normalizes an email lookup and returns the verified public user shape", async () => {
    const passwordHash = await bcrypt.hash("correct horse", 4);
    boundary.findFirst.mockResolvedValue({
      id: "user-1",
      email: "alice@example.test",
      username: "alice",
      nickname: "Alice",
      role: "ADMIN",
      password: passwordHash,
      internalOnly: "must not leak",
    });

    await expect(verifyCredentials("  Alice@Example.Test  ", "correct horse")).resolves.toEqual({
      id: "user-1",
      email: "alice@example.test",
      name: "Alice",
      role: "ADMIN",
      nickname: "Alice",
      username: "alice",
    });
    expect(boundary.findFirst).toHaveBeenCalledWith({
      where: { email: "alice@example.test" },
    });
  });

  it("uses an exact trimmed username and falls back to username as display name", async () => {
    const passwordHash = await bcrypt.hash("secret", 4);
    boundary.findFirst.mockResolvedValue({
      id: "user-2",
      email: "bob@example.test",
      username: "Bob",
      nickname: null,
      role: "USER",
      password: passwordHash,
    });

    await expect(verifyCredentials("  Bob  ", "secret")).resolves.toMatchObject({
      name: "Bob",
      nickname: null,
      username: "Bob",
    });
    expect(boundary.findFirst).toHaveBeenCalledWith({ where: { username: "Bob" } });
  });

  it("returns null for an incorrect password", async () => {
    boundary.findFirst.mockResolvedValue({
      id: "user-3",
      email: "wrong@example.test",
      username: "wrong",
      nickname: null,
      role: "USER",
      password: await bcrypt.hash("right password", 4),
    });

    await expect(verifyCredentials("wrong", "wrong password")).resolves.toBeNull();
  });

  it("runs the dummy-password path for an unknown identifier", async () => {
    boundary.findFirst.mockResolvedValue(null);

    await expect(verifyCredentials("nobody@example.test", "guess")).resolves.toBeNull();
    expect(boundary.findFirst).toHaveBeenCalledOnce();
  });
});

describe("role helpers", () => {
  it.each([
    ["ADMIN", true],
    ["EDITOR", false],
    ["USER", false],
    [undefined, false],
  ] as const)("identifies admin role %j", (role, expected) => {
    expect(isAdminRole(role)).toBe(expected);
    expect(canPublishContent(role)).toBe(expected);
  });

  it.each([
    ["ADMIN", true],
    ["EDITOR", true],
    ["USER", true],
    ["", false],
    [undefined, false],
  ] as const)("allows signed-in role %j to comment", (role, expected) => {
    expect(canComment(role)).toBe(expected);
  });
});

describe("getCspNonce", () => {
  it("returns early in development without reading request headers", async () => {
    Reflect.set(process.env, "NODE_ENV", "development");
    boundary.nonce = "dev-nonce";

    await expect(getCspNonce()).resolves.toBeUndefined();
    expect(boundary.headers).not.toHaveBeenCalled();
  });

  it("returns the trimmed production request nonce", async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    boundary.nonce = "  production-nonce  ";

    await expect(getCspNonce()).resolves.toBe("production-nonce");
    expect(boundary.headers).toHaveBeenCalledOnce();
  });

  it.each([null, "   "])("returns undefined for absent nonce %j", async (nonce) => {
    Reflect.set(process.env, "NODE_ENV", "production");
    boundary.nonce = nonce;
    await expect(getCspNonce()).resolves.toBeUndefined();
  });
});

describe("isAllowedAdminMutationOrigin", () => {
  it("accepts an Origin matching the request host", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    expect(
      isAllowedAdminMutationOrigin(
        request({ host: "admin.example.test:443", origin: "https://admin.example.test" })
      )
    ).toBe(true);
  });

  it("accepts an allowed environment host and rejects a different host", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.AUTH_URL = "https://auth.example.test";
    const matching = request({ host: "internal:3000", origin: "https://auth.example.test" });
    const foreign = request({ host: "internal:3000", origin: "https://evil.example.test" });

    expect(isAllowedAdminMutationOrigin(matching)).toBe(true);
    expect(isAllowedAdminMutationOrigin(foreign)).toBe(false);
  });

  it("falls back to Referer when Origin is absent", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.SITE_URL = "https://site.example.test";
    expect(
      isAllowedAdminMutationOrigin(
        request({ referer: "https://site.example.test/admin/settings" })
      )
    ).toBe(true);
  });

  it("uses the first forwarded host and rejects malformed Origin", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.TRUST_PROXY_HEADERS = "true";
    const req = request({
      "x-forwarded-host": "proxy.example.test:443, internal:3000",
      host: "internal:3000",
      origin: "not-a-url",
    });
    expect(isAllowedAdminMutationOrigin(req)).toBe(false);
  });

  it("trusts forwarded scheme and first host only when explicitly enabled", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.TRUST_PROXY_HEADERS = "true";
    const req = request({
      "x-forwarded-host": "public.example.test:8443, internal:3000",
      "x-forwarded-proto": "https, http",
      host: "internal:3000",
      origin: "https://public.example.test:8443",
    });
    expect(isAllowedAdminMutationOrigin(req)).toBe(true);
  });

  it("falls back to request protocol for an untrusted forwarded protocol", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.TRUST_PROXY_HEADERS = "true";
    const req = request({
      "x-forwarded-host": "admin.example.test",
      "x-forwarded-proto": "ftp",
      origin: "https://admin.example.test",
    });
    expect(isAllowedAdminMutationOrigin(req)).toBe(true);
  });

  it("falls back to Host when trusted proxy headers are absent", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.TRUST_PROXY_HEADERS = "true";
    expect(
      isAllowedAdminMutationOrigin(
        request({ host: "admin.example.test", origin: "https://admin.example.test" })
      )
    ).toBe(true);
  });

  it.each([
    "http://admin.example.test",
    "https://admin.example.test:4444",
  ])("rejects a different scheme or port: %s", (origin) => {
    Reflect.set(process.env, "NODE_ENV", "production");
    expect(
      isAllowedAdminMutationOrigin(request({ host: "admin.example.test", origin }))
    ).toBe(false);
  });

  it("ignores invalid environment URLs and fails closed in production", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.NEXT_PUBLIC_SITE_URL = "not a URL";
    expect(isAllowedAdminMutationOrigin(request({}))).toBe(false);
  });

  it("fails closed without Origin or Referer even when an allowed origin is configured", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.AUTH_URL = "https://admin.example.test";
    expect(isAllowedAdminMutationOrigin(request({}))).toBe(false);
  });

  it("permits missing origin metadata only in development", () => {
    Reflect.set(process.env, "NODE_ENV", "development");
    process.env.AUTH_URL = "https://admin.example.test";
    expect(isAllowedAdminMutationOrigin(request({}))).toBe(true);
  });
});
