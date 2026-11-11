import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m=vi.hoisted(()=>({ admin:vi.fn(),origin:vi.fn(),read:vi.fn(),tx:vi.fn(),audit:vi.fn(),update:vi.fn(),create:vi.fn() }));
vi.mock("@/lib/guards",async()=>({requireAdmin:m.admin,ApiError:(await import("@/lib/api-error")).ApiError}));
vi.mock("@/lib/csrf-origin",()=>({isAllowedMutationOrigin:m.origin,hasJsonContentType:(r:Request)=>r.headers.get("content-type")==="application/json"}));
vi.mock("@/lib/assistant-catalog-store",()=>({readLoginCatalog:m.read}));
vi.mock("@/lib/prisma",()=>({prisma:{$transaction:m.tx}}));
vi.mock("@/lib/admin-audit-log",()=>({auditAdminActionStrict:m.audit}));
import { PUT } from "../src/app/api/admin/assistant-services/servers/route";
import { POST } from "../src/app/api/admin/assistant-services/recover/route";
import { initialCatalog } from "../src/lib/assistant-catalog";
import { ApiError } from "../src/lib/api-error";
const request=(data:unknown)=>new NextRequest("https://example.test/api/admin/assistant-services/servers",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
beforeEach(()=>{vi.resetAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();m.admin.mockResolvedValue({user:{id:"admin"}});m.origin.mockReturnValue(true);m.read.mockResolvedValue({catalog:initialCatalog,raw:JSON.stringify(initialCatalog)});m.update.mockResolvedValue({count:1});m.tx.mockImplementation(async fn=>fn({siteSetting:{updateMany:m.update,create:m.create},adminAuditLog:{create:m.audit}}));});
it("requires administrator and same origin before touching configuration",async()=>{
 m.admin.mockRejectedValue(new ApiError("no",40100,401));expect((await PUT(request(initialCatalog))).status).toBe(401);expect(m.read).not.toHaveBeenCalled();
 m.admin.mockResolvedValue({user:{id:"admin"}});m.origin.mockReturnValue(false);expect((await PUT(request(initialCatalog))).status).toBe(403);expect(m.tx).not.toHaveBeenCalled();
});
it("prevents stale editors from overwriting changes and detects update races",async()=>{
 expect((await PUT(request({...initialCatalog,revision:"old"}))).status).toBe(409);expect(m.tx).not.toHaveBeenCalled();
 m.update.mockResolvedValue({count:0});expect((await PUT(request(initialCatalog))).status).toBe(409);expect(m.audit).not.toHaveBeenCalled();
});
it("publishes revision and audit in the same transaction",async()=>{
 const result=await PUT(request(initialCatalog));expect(result.status).toBe(200);expect((await result.json()).data.revision).not.toBe(initialCatalog.revision);expect(m.audit).toHaveBeenCalledOnce();
});
it("recovery accepts only fixed regions and never forwards caller credentials",async()=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);vi.stubEnv("IPATOOL_OPERATOR_KEY","x".repeat(32));
 expect((await POST(request({region:"cn",password:"secret"}))).status).toBe(422);expect(fetcher).not.toHaveBeenCalled();
 m.origin.mockReturnValue(false);expect((await POST(request({region:"cn"}))).status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
});
it("recovery fails closed when audit fails",async()=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);vi.stubEnv("IPATOOL_OPERATOR_KEY","x".repeat(32));m.audit.mockRejectedValue(new Error("db"));expect((await POST(request({region:"cn"}))).status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
});
it("dispatches an asynchronous operation to the fixed regional port",async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({data:{id:"test"}},{status:202}));vi.stubGlobal("fetch",fetcher);vi.stubEnv("IPATOOL_OPERATOR_KEY","x".repeat(32));expect((await POST(request({region:"us"}))).status).toBe(202);expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:18091/api/recover");expect(fetcher.mock.calls[0][1].body).toBeUndefined();
});
