import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { parseManifestInput, renderManifest, validLegacySignature } from "../src/lib/assistant-manifest";

const query = () => new URLSearchParams({ bundle_id: "com.test.app", bundle_version: "1.2", title: "测试 & 安装", nonce: "a".repeat(32), client_ip: "192.168.1.8", port: "7890", route: "/session/private/app.ipa?ticket=a%20b&x=1" });
describe("legacy phone-hosted OTA", () => {
  it("preserves local address, authorization path, Chinese title and XML escaping", () => {
    const input = parseManifestInput(query(), "127.0.0.1");
    expect(input.ipaUrl).toBe("http://192.168.1.8:7890/session/private/app.ipa?ticket=a%20b&x=1");
    const xml = renderManifest(input);
    expect(xml).toContain("测试 &amp; 安装"); expect(xml).toContain("a%20b&amp;x=1"); expect(xml).toContain("software-package");
  });
  it.each([ ["nonce", "../overwrite"], ["client_ip", "example.org/path"], ["port", "0"], ["port", "65536"], ["route", "//attacker.test/a"], ["route", "/a\nX: y"], ["bundle_id", "<script>"], ["display_image_url", "javascript:alert(1)"] ])("rejects unsafe %s", (key, value) => {
    const params = query(); params.set(key, value); expect(() => parseManifestInput(params, "127.0.0.1")).toThrow();
  });
  it("rejects duplicates; supports IPv6; never uses Host to construct the IPA URL", () => {
    const params = query(); params.append("nonce", "b"); expect(() => parseManifestInput(params, "127.0.0.1")).toThrow();
    params.delete("nonce"); params.set("nonce", "safe"); params.set("client_ip", "::1"); expect(parseManifestInput(params, "127.0.0.1").ipaUrl).toContain("http://[::1]:7890/");
  });
  it("matches installed Swift canonical signing including unencoded Chinese and ampersands", () => {
    const values = Object.fromEntries(query());
    const signature = createHmac("sha256", "test-secret").update(Object.keys(values).sort().map(k => `${k}=${values[k]}`).join("&")).digest("hex");
    expect(validLegacySignature({ ...values, signature }, "test-secret")).toBe(true);
    expect(validLegacySignature({ ...values, signature }, "wrong")).toBe(false);
    expect(validLegacySignature(values, "test-secret")).toBe(false);
  });
});
