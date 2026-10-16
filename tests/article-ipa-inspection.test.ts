import { describe, expect, it, vi, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
vi.mock("@/lib/guards", () => ({ ApiError: class ApiError extends Error { constructor(message: string, public code: number, public status: number) { super(message); } } }));
import { saveAndInspectIpa } from "@/lib/article-ipa-server";
const root = await mkdtemp(path.join(tmpdir(), "ipa-inspect-"));
const oldDir = process.env.IPA_UPLOAD_DIR;
const oldPython = process.env.IPA_PYTHON;
process.env.IPA_UPLOAD_DIR = path.join(root, "private"); process.env.IPA_PYTHON = "python3";
afterAll(async () => { process.env.IPA_UPLOAD_DIR = oldDir; process.env.IPA_PYTHON = oldPython; await rm(root,{recursive:true,force:true}); });
async function fixture(prefix: string, plistName="Info.plist", executable=true) {
 const filename=path.join(root,"fixture.ipa");
 execFileSync("python3",["-I","-c",`import sys,zipfile,plistlib
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr(sys.argv[2]+sys.argv[3],plistlib.dumps(dict(CFBundleName='Test',CFBundleIdentifier='test.ipa',CFBundleShortVersionString='1.0',CFBundleVersion='7',CFBundleExecutable='Test'),fmt=plistlib.FMT_BINARY))
 if sys.argv[4]=='yes': z.writestr(sys.argv[2]+'Test',b'fixture')`,filename,prefix,plistName,executable?"yes":"no"]);
 return new File([await readFile(filename)],"example.ipa");
}
describe("IPA archive inspection", () => {
 it("reads binary plists from the main app",async()=>{ const result=await saveAndInspectIpa(await fixture("Payload/Test.app/")); expect(result.version).toBe("1.0");expect(result.build).toBe("7");expect(result.sha256).toMatch(/^[a-f0-9]{64}$/); });
 it.each([["Payload/TestXapp/","Info.plist"],["Payload/Test.app/","InfoXplist"],["Elsewhere/Test.app/","Info.plist"]])("rejects misleading app and plist paths",async(prefix,name)=>{ await expect(saveAndInspectIpa(await fixture(prefix,name))).rejects.toThrow("IPA 无效"); });
 it("rejects a package with no executable and cleans failed uploads",async()=>{
  const before=await readdir(path.join(root,"private"));await expect(saveAndInspectIpa(await fixture("Payload/Test.app/","Info.plist",false))).rejects.toThrow("IPA 无效");expect(await readdir(path.join(root,"private"))).toEqual(before);
 });
 it("rejects tiny and renamed non-archives",async()=>{await expect(saveAndInspectIpa(new File(["x"],"wrong.ipa"))).rejects.toThrow("有效的 IPA");await expect(saveAndInspectIpa(new File(["x"],"wrong.png"))).rejects.toThrow(".ipa");});
});
