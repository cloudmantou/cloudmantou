import { z } from "zod";

export const CATALOG_KEY = "assistantLoginServers";
export function validServerURL(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash && u.hostname.includes(".") && !/[\s\\]/.test(value);
  } catch { return false; }
}
const endpoint = z.string().trim().max(500).refine(validServerURL, "服务器地址必须为无账号、查询参数的 HTTPS 地址");
export const serverSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), name: z.string().trim().min(1).max(60),
  apiBase: endpoint, sourceBase: endpoint, description: z.string().trim().max(160),
  sortOrder: z.number().int().min(0).max(999), enabled: z.boolean(), isHidden: z.boolean(),
}).strict();
export const catalogSchema = z.object({ revision: z.string().max(64), servers: z.array(serverSchema).min(1).max(32) }).strict().superRefine((catalog, ctx) => {
  if (!catalog.servers.some(s => s.enabled)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "至少保留一个启用的服务器", path: ["servers"] });
  for (const field of ["id", "apiBase"] as const) {
    const values = catalog.servers.map(s => s[field].replace(/\/+$/, ""));
    if (new Set(values).size !== values.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "服务器标识或地址重复", path: ["servers"] });
  }
});
export type LoginServerCatalog = z.infer<typeof catalogSchema>;
export const initialCatalog: LoginServerCatalog = { revision: "initial", servers: [
  { id: "mantou", name: "馒头自建服务器", apiBase: "https://p12.cloudmantoua.top/v3", sourceBase: "https://p12.cloudmantoua.top/v3", description: "馒头维护的登录节点", sortOrder: 0, enabled: true, isHidden: true },
  { id: "sidestore", name: "SideStore", apiBase: "https://ani.sidestore.io", sourceBase: "https://ani.sidestore.io", description: "备用登录节点", sortOrder: 10, enabled: true, isHidden: false },
] };
export function publicCatalog(catalog: LoginServerCatalog, sideStore = false) {
  const servers = [...catalog.servers].filter(s => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return sideStore ? { servers: servers.map(s => ({ name: s.name, address: s.sourceBase })) } : {
    revision: catalog.revision, servers: servers.map(s => ({ name: s.name, api_base: s.apiBase, anisette_base: s.sourceBase, relay_base: null, isHidden: s.isHidden, description: s.description })),
  };
}
