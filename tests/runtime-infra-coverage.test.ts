import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const boundary = vi.hoisted(() => {
  const state = {
    authSetup: null as Record<string, any> | null,
  };

  return {
    state,
    nextAuth: vi.fn((config: Record<string, any>) => {
      state.authSetup = config;
      return {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      };
    }),
    credentials: vi.fn((config: Record<string, any>) => ({
      id: "credentials",
      ...config,
    })),
    checkLoginRateLimit: vi.fn(),
    verifyCredentials: vi.fn(),
    userFindUnique: vi.fn(),
    adminAuditCreate: vi.fn(),
    paymentNotifyAuditCreate: vi.fn(),
    getClientIP: vi.fn(),
  };
});

vi.mock("next-auth", () => ({ default: boundary.nextAuth }));
vi.mock("next-auth/providers/credentials", () => ({ default: boundary.credentials }));
vi.mock("@/lib/login-rate-limit-server", () => ({
  checkLoginRateLimitServer: boundary.checkLoginRateLimit,
}));
vi.mock("@/lib/credentials-auth", () => ({
  verifyCredentials: boundary.verifyCredentials,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: boundary.userFindUnique },
    adminAuditLog: { create: boundary.adminAuditCreate },
    paymentNotifyAudit: { create: boundary.paymentNotifyAuditCreate },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ getClientIP: boundary.getClientIP }));

import { authConfig } from "@/lib/auth.config";
import { auth, handlers, signIn, signOut } from "@/lib/auth";
import { auditAdminAction, recordAdminAudit } from "@/lib/admin-audit-log";
import { recordPaymentNotifyAudit } from "@/lib/payment-notify-audit";

type AuthCallback = (input: Record<string, any>) => Promise<any> | any;

function authCallbacks() {
  const callbacks = boundary.state.authSetup?.callbacks;
  if (!callbacks) throw new Error("NextAuth callbacks were not registered");
  return callbacks as { jwt: AuthCallback; session: AuthCallback };
}

function credentialsAuthorize(): (
  credentials: Record<string, unknown>,
  request: unknown
) => Promise<unknown> {
  const provider = boundary.state.authSetup?.providers?.[0];
  if (!provider?.authorize) throw new Error("Credentials authorize was not registered");
  return provider.authorize;
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.checkLoginRateLimit.mockResolvedValue({ success: true });
  boundary.verifyCredentials.mockResolvedValue({ id: "verified-user" });
  boundary.userFindUnique.mockResolvedValue({
    role: "USER",
    nickname: "Database Nickname",
    username: "database-user",
  });
  boundary.adminAuditCreate.mockResolvedValue({ id: "admin-audit-1" });
  boundary.paymentNotifyAuditCreate.mockResolvedValue({ id: "payment-audit-1" });
  boundary.getClientIP.mockReturnValue("203.0.113.9");
});

describe("edge-safe auth configuration", () => {
  it("publishes the intended sign-in page and JWT session strategy", () => {
    expect(authConfig.pages).toEqual({ signIn: "/login" });
    expect(authConfig.session).toEqual({ strategy: "jwt" });
    expect(authConfig.providers).toEqual([]);
  });

  it("copies the signed-in user identity into the JWT", async () => {
    const token = { existing: "kept" };
    const user = {
      id: "user-1",
      role: "ADMIN",
      nickname: undefined,
      username: "alice",
    };

    await expect(
      (authConfig.callbacks.jwt as AuthCallback)({ token, user })
    ).resolves.toEqual({
      existing: "kept",
      id: "user-1",
      role: "ADMIN",
      nickname: null,
      username: "alice",
    });
  });

  it("leaves an existing JWT unchanged when no user signed in", async () => {
    const token = { id: "user-1", role: "USER" };
    await expect(
      (authConfig.callbacks.jwt as AuthCallback)({ token, user: undefined })
    ).resolves.toBe(token);
  });

  it("preserves supplied nullable identity values in the JWT", async () => {
    await expect(
      (authConfig.callbacks.jwt as AuthCallback)({
        token: {},
        user: {
          id: "user-2",
          role: "USER",
          nickname: "Bob",
          username: undefined,
        },
      })
    ).resolves.toMatchObject({ nickname: "Bob", username: null });
  });

  it("invalidates a session whose token was revoked", () => {
    const session = { user: { name: "Alice" }, expires: "future" };

    expect(
      (authConfig.callbacks.session as AuthCallback)({
        session,
        token: { sessionInvalid: true },
      })
    ).toEqual({ user: { name: "Alice" }, expires: new Date(0).toISOString() });
  });

  it("maps JWT identity fields into a session user with null defaults", () => {
    const session = { user: { name: "Alice" }, expires: "future" };

    expect(
      (authConfig.callbacks.session as AuthCallback)({
        session,
        token: { id: "user-1", role: "EDITOR" },
      })
    ).toEqual({
      user: {
        name: "Alice",
        id: "user-1",
        role: "EDITOR",
        nickname: null,
        username: null,
      },
      expires: "future",
    });
  });

  it("returns sessions without a user unchanged", () => {
    const session = { expires: "future" };
    expect(
      (authConfig.callbacks.session as AuthCallback)({ session, token: {} })
    ).toBe(session);
  });

  it("preserves supplied nickname and username in the session", () => {
    const session = { user: { name: "Alice" }, expires: "future" };
    expect(
      (authConfig.callbacks.session as AuthCallback)({
        session,
        token: {
          id: "user-1",
          role: "ADMIN",
          nickname: "Alice",
          username: "alice",
        },
      })
    ).toMatchObject({
      user: { nickname: "Alice", username: "alice" },
    });
  });
});

describe("runtime NextAuth configuration", () => {
  it("exports the runtime functions returned by NextAuth", () => {
    expect(handlers).toEqual(expect.objectContaining({ GET: expect.any(Function) }));
    expect(auth).toEqual(expect.any(Function));
    expect(signIn).toEqual(expect.any(Function));
    expect(signOut).toEqual(expect.any(Function));
    expect(boundary.state.authSetup?.pages).toEqual({ signIn: "/login" });
  });

  it.each([
    [undefined, "password"],
    ["alice@example.test", undefined],
  ])("rejects incomplete credentials without hitting boundaries", async (email, password) => {
    await expect(
      credentialsAuthorize()({ email, password }, {})
    ).resolves.toBeNull();
    expect(boundary.checkLoginRateLimit).not.toHaveBeenCalled();
    expect(boundary.verifyCredentials).not.toHaveBeenCalled();
  });

  it("rate-limits a trimmed identifier before verifying credentials", async () => {
    const request = { headers: new Headers() };

    await expect(
      credentialsAuthorize()(
        { email: "  Alice@Example.test  ", password: "secret" },
        request
      )
    ).resolves.toEqual({ id: "verified-user" });

    expect(boundary.checkLoginRateLimit).toHaveBeenCalledWith(
      request,
      "Alice@Example.test"
    );
    expect(boundary.verifyCredentials).toHaveBeenCalledWith(
      "Alice@Example.test",
      "secret"
    );
  });

  it("rejects a rate-limited login before password verification", async () => {
    boundary.checkLoginRateLimit.mockResolvedValue({ success: false });

    await expect(
      credentialsAuthorize()({ email: "alice", password: "secret" }, {})
    ).rejects.toThrow("登录尝试过于频繁，请稍后再试");
    expect(boundary.verifyCredentials).not.toHaveBeenCalled();
  });

  it("does not query Prisma for an anonymous JWT", async () => {
    const token = { role: "USER" };

    await expect(authCallbacks().jwt({ token, user: undefined })).resolves.toBe(token);
    expect(boundary.userFindUnique).not.toHaveBeenCalled();
  });

  it("refreshes signed-in identity fields from the current database row", async () => {
    boundary.userFindUnique.mockResolvedValue({
      role: "ADMIN",
      nickname: "Current Nickname",
      username: "current-user",
    });

    await expect(
      authCallbacks().jwt({
        token: {},
        user: {
          id: "user-1",
          role: "USER",
          nickname: "Old Nickname",
          username: "old-user",
        },
      })
    ).resolves.toEqual({
      id: "user-1",
      role: "ADMIN",
      nickname: "Current Nickname",
      username: "current-user",
    });
    expect(boundary.userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { role: true, nickname: true, username: true },
    });
  });

  it("marks a token invalid when its database user no longer exists", async () => {
    boundary.userFindUnique.mockResolvedValue(null);

    await expect(
      authCallbacks().jwt({
        token: {},
        user: { id: "deleted-user", role: "USER" },
      })
    ).resolves.toEqual({
      id: "deleted-user",
      role: "USER",
      nickname: null,
      username: null,
      sessionInvalid: true,
    });
  });

  it("expires an invalid runtime session and maps a valid one", () => {
    expect(
      authCallbacks().session({
        session: { user: { name: "Deleted" }, expires: "future" },
        token: { sessionInvalid: true },
      })
    ).toEqual({
      user: { name: "Deleted" },
      expires: new Date(0).toISOString(),
    });

    expect(
      authCallbacks().session({
        session: { user: { name: "Alice" }, expires: "future" },
        token: {
          id: "user-1",
          role: "ADMIN",
          nickname: "Alice",
          username: "alice",
        },
      })
    ).toEqual({
      user: {
        name: "Alice",
        id: "user-1",
        role: "ADMIN",
        nickname: "Alice",
        username: "alice",
      },
      expires: "future",
    });
  });

  it("keeps a runtime session without a user unchanged", () => {
    const session = { expires: "future" };
    expect(authCallbacks().session({ session, token: {} })).toBe(session);
  });

  it("uses null defaults for absent runtime session profile fields", () => {
    expect(
      authCallbacks().session({
        session: { user: { name: "Alice" }, expires: "future" },
        token: { id: "user-1", role: "USER" },
      })
    ).toMatchObject({
      user: { nickname: null, username: null },
    });
  });
});

describe("admin audit persistence", () => {
  it("normalizes bounded audit fields before writing", async () => {
    const detail = "d".repeat(4_100);

    await recordAdminAudit({
      actorId: "admin-1",
      action: "a".repeat(120),
      targetType: "t".repeat(80),
      targetId: "i".repeat(120),
      detail,
      ip: "1".repeat(80),
    });

    expect(boundary.adminAuditCreate).toHaveBeenCalledWith({
      data: {
        actorId: "admin-1",
        action: "a".repeat(100),
        targetType: "t".repeat(50),
        targetId: "i".repeat(100),
        detail: detail.slice(0, 4_000),
        ip: "1".repeat(64),
      },
    });
  });

  it("stores absent optional audit fields as null", async () => {
    await recordAdminAudit({ actorId: "admin-1", action: "LOGIN" });

    expect(boundary.adminAuditCreate).toHaveBeenCalledWith({
      data: {
        actorId: "admin-1",
        action: "LOGIN",
        targetType: null,
        targetId: null,
        detail: null,
        ip: null,
      },
    });
  });

  it("records request IP and supplied target metadata", async () => {
    const request = { headers: new Headers() } as any;

    await auditAdminAction(request, "admin-1", "UPDATE_USER", {
      targetType: "User",
      targetId: "user-2",
      detail: "role changed",
    });

    expect(boundary.getClientIP).toHaveBeenCalledWith(request);
    expect(boundary.adminAuditCreate).toHaveBeenCalledWith({
      data: {
        actorId: "admin-1",
        action: "UPDATE_USER",
        targetType: "User",
        targetId: "user-2",
        detail: "role changed",
        ip: "203.0.113.9",
      },
    });
  });

  it("logs and swallows audit persistence failures", async () => {
    const error = new Error("database unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    boundary.adminAuditCreate.mockRejectedValue(error);

    await expect(
      recordAdminAudit({ actorId: "admin-1", action: "UPDATE" })
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[AdminAuditLog] write failed:",
      error
    );
    consoleError.mockRestore();
  });
});

describe("payment notification audit persistence", () => {
  it("bounds provider-controlled fields before writing", async () => {
    const rawBody = "x".repeat(70_000);

    await recordPaymentNotifyAudit({
      channel: "WECHAT",
      orderNo: "o".repeat(80),
      status: "s".repeat(80),
      reason: "r".repeat(600),
      rawBody,
    });

    expect(boundary.paymentNotifyAuditCreate).toHaveBeenCalledWith({
      data: {
        channel: "WECHAT",
        orderNo: "o".repeat(64),
        status: "s".repeat(64),
        reason: "r".repeat(500),
        rawBody: `sha256:${createHash("sha256").update(rawBody).digest("hex")};bytes:70000`,
      },
    });
  });

  it("preserves an in-bounds body and nulls absent optional fields", async () => {
    await recordPaymentNotifyAudit({
      channel: "ALIPAY",
      status: "VERIFIED",
      rawBody: "signed-payload",
    });

    expect(boundary.paymentNotifyAuditCreate).toHaveBeenCalledWith({
      data: {
        channel: "ALIPAY",
        orderNo: null,
        status: "VERIFIED",
        reason: null,
        rawBody: `sha256:${createHash("sha256").update("signed-payload").digest("hex")};bytes:14`,
      },
    });
  });

  it.each([undefined, ""])("stores empty raw body %j as null", async (rawBody) => {
    await recordPaymentNotifyAudit({
      channel: "WECHAT",
      status: "EMPTY",
      rawBody,
    });

    expect(boundary.paymentNotifyAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ rawBody: null }),
    });
  });

  it("logs and swallows persistence failures", async () => {
    const error = new Error("database unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    boundary.paymentNotifyAuditCreate.mockRejectedValue(error);

    await expect(
      recordPaymentNotifyAudit({ channel: "ALIPAY", status: "FAILED" })
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[PaymentNotifyAudit] write failed:",
      error
    );
    consoleError.mockRestore();
  });
});
