import { describe, expect, it } from "vitest";
import { catalogSchema, initialCatalog, publicCatalog } from "../src/lib/assistant-catalog";
describe("managed login catalog", () => {
 it("keeps legacy wire keys, publishes names and never exposes disabled entries", () => {
  const catalog = structuredClone(initialCatalog); catalog.servers[0].name = "新名称"; catalog.servers[1].enabled = false;
  const body = publicCatalog(catalog);
  expect(body.servers).toEqual([{ name: "新名称", api_base: catalog.servers[0].apiBase, anisette_base: catalog.servers[0].sourceBase, relay_base: null, isHidden: true, description: catalog.servers[0].description }]);
  expect(publicCatalog(catalog,true)).toEqual({ servers: [{ name: "新名称", address: catalog.servers[0].sourceBase }] });
 });
 it("rejects malformed, duplicated, insecure or credential-bearing addresses", () => {
  for (const url of ["http://node.example", "https://user:password@node.example", "https://node.example/?token=secret", "https://node.example/#secret", "https://node.example/ a"]) {
   const c = structuredClone(initialCatalog);c.servers[0].apiBase=url;expect(catalogSchema.safeParse(c).success).toBe(false);
  }
  const c=structuredClone(initialCatalog);c.servers.push(c.servers[0]);expect(catalogSchema.safeParse(c).success).toBe(false);
 });
 it("rejects accidental empty and all-disabled publications", () => {
  expect(catalogSchema.safeParse({ revision:"x",servers:[] }).success).toBe(false);
  expect(catalogSchema.safeParse({ ...initialCatalog,servers:initialCatalog.servers.map(s=>({...s,enabled:false})) }).success).toBe(false);
 });
});
