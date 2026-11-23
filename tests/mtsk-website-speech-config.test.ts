import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as catalog, POST as credential } from "@/app/api/reader/speech/client-config/route";
import { GET as newChallenge } from "@/app/api/reader/speech/client-config/challenge/route";

const fakes = vi.hoisted(() => ({
  values: new Map<string, string>(),
  attest: vi.fn(),
  assert: vi.fn(),
}));

vi.mock("node-app-attest", () => ({ verifyAttestation: fakes.attest, verifyAssertion: fakes.assert }));
vi.mock("@/lib/rate-limit-server", () => ({ checkRateLimit: async () => null }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteSetting: {
      createMany: async ({ data: [{ key, value }] }: { data: { key: string; value: string }[] }) => {
        if (fakes.values.has(key)) return { count: 0 };
        fakes.values.set(key, value);
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { key: string } }) => {
        const value = fakes.values.get(where.key);
        return value === undefined ? null : { value };
      },
      updateMany: async ({ where, data }: { where: { key: string; value: string }; data: { value: string } }) => {
        if (fakes.values.get(where.key) !== where.value) return { count: 0 };
        fakes.values.set(where.key, data.value);
        return { count: 1 };
      },
    },
  },
}));

const url = "https://cloudmantoua.top/api/reader/speech/client-config";
const installation = Buffer.alloc(32, 7).toString("base64");
const testProof = Buffer.from("proof").toString("base64");
const fixtureKey = "fixture-mimo-key-for-official-app";

async function challenge() {
  const response = await newChallenge(new Request(url + "/challenge"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  return (await response.json()).data.challenge as string;
}

function submit(body: Record<string, unknown>) {
  return credential(new Request(url, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }));
}

beforeEach(() => {
  fakes.values.clear();
  fakes.attest.mockReset();
  fakes.assert.mockReset();
  vi.stubEnv("MTSK_OFFICIAL_MIMO_API_KEY", fixtureKey);
  vi.stubEnv("MTSK_APP_ATTEST_TEAM_ID", "ABCDEF1234");
  vi.stubEnv("AUTH_SECRET", "fixture-auth-sealing-secret");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => vi.unstubAllEnvs());

describe("MTSK website speech configuration", () => {
  it("publishes only the catalog and direct MiMo endpoints", async () => {
    const response = await catalog().json();
    expect(response.data.rolesEndpoint).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(response.data.ttsEndpoint).toBe(response.data.rolesEndpoint);
    expect(response.data.catalog.officialServiceEnabled).toBe(true);
    expect(JSON.stringify(response)).not.toContain(fixtureKey);
  });

  it("issues the selected MiMo key after app attestation and rejects a replayed registration", async () => {
    fakes.attest.mockResolvedValue({ publicKey: "public-key-fixture" });
    const nonce = await challenge();
    const input = { challenge: nonce, keyId: installation, attestation: testProof };
    const response = await submit(input);
    expect(await response.json()).toMatchObject({ data: { apiKey: fixtureKey, baseURL: "https://api.xiaomimimo.com/v1" } });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(fakes.attest).toHaveBeenCalledWith(expect.objectContaining({
      challenge: nonce, bundleIdentifier: "com.mantou.mtsk", teamIdentifier: "ABCDEF1234",
      allowDevelopmentEnvironment: false,
    }));
    expect((await submit(input)).status).toBe(401);
  });

  it("rejects tampered challenges before invoking device verification", async () => {
    const nonce = await challenge();
    const replacement = nonce[15] === "A" ? "B" : "A";
    const tampered = nonce.slice(0, 15) + replacement + nonce.slice(16);
    expect((await submit({ challenge: tampered, keyId: installation, attestation: testProof })).status).toBe(401);
    expect(fakes.attest).not.toHaveBeenCalled();
  });

  it("refreshes using a valid assertion and refuses a repeated counter", async () => {
    fakes.attest.mockResolvedValue({ publicKey: "public-key-fixture" });
    fakes.assert.mockResolvedValue({ signCount: 1 });
    await submit({ challenge: await challenge(), keyId: installation, attestation: testProof });
    const nonce = await challenge();
    expect((await submit({ challenge: nonce, keyId: installation, assertion: testProof })).status).toBe(200);
    expect(fakes.assert).toHaveBeenCalledWith(expect.objectContaining({ payload: nonce, signCount: 0 }));
    expect((await submit({ challenge: await challenge(), keyId: installation, assertion: testProof })).status).toBe(401);
  });

  it("rejects an unregistered installation or an invalid proof", async () => {
    const unknown = await submit({ challenge: await challenge(), keyId: installation, assertion: testProof });
    expect(await unknown.json()).toMatchObject({ code: 40119, data: null });
    fakes.attest.mockRejectedValue(new Error("invalid proof"));
    const invalid = await submit({ challenge: await challenge(), keyId: installation, attestation: testProof });
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toMatchObject({ data: null });
  });

  it("reports the service as closed when the website key is absent", async () => {
    vi.stubEnv("MTSK_OFFICIAL_MIMO_API_KEY", "");
    expect((await catalog().json()).data.catalog.officialServiceEnabled).toBe(false);
    fakes.attest.mockResolvedValue({ publicKey: "public-key-fixture" });
    const response = await submit({ challenge: await challenge(), keyId: installation, attestation: testProof });
    expect(response.status).toBe(503);
  });
});
