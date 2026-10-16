import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/guards";
import { IPA_MAX_BYTES, type ArticleIpaInput } from "@/lib/article-ipa";

const execFileAsync = promisify(execFile);
export function ipaStoragePath(key: string): string {
  if (!/^[a-f0-9-]{36}\.ipa$/.test(key)) throw new Error("Invalid IPA storage key");
  const root = process.env.IPA_UPLOAD_DIR?.trim();
  if (process.env.NODE_ENV === "production" && (!root || !path.isAbsolute(root))) {
    throw new Error("Configure persistent absolute IPA_UPLOAD_DIR outside public uploads");
  }
  const resolved = path.resolve(root || ".data/ipa-releases");
  const publicDir = path.resolve(process.cwd(), "public");
  const images = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : publicDir;
  if ([publicDir, images].some(dir => resolved === dir || resolved.startsWith(`${dir}${path.sep}`))) {
    throw new Error("IPA_UPLOAD_DIR must be private");
  }
  return path.join(resolved, key);
}

// Read only the bounded main Info.plist; never extract archive paths or execute app code.
const inspectScript = String.raw`import sys,zipfile,plistlib,json,re,struct
with open(sys.argv[1],"rb") as f:
 f.seek(0,2); size=f.tell(); f.seek(max(0,size-65557)); tail=f.read(65557)
 end=tail.rfind(b"PK\x05\x06")
 if end<0 or end+22>len(tail): raise ValueError("Invalid ZIP directory")
 record=struct.unpack_from("<4s4H2LH",tail,end)
 if record[1] or record[2] or record[4]>50000 or record[5]>16777216 or end+22+record[7]!=len(tail): raise ValueError("ZIP directory limit exceeded")
with zipfile.ZipFile(sys.argv[1]) as z:
 infos=z.infolist()
 if len(infos)>50000: raise ValueError('Too many files')
 matches=[i for i in infos if re.fullmatch(r'Payload/[^/]+\.app/Info\.plist',i.filename)]
 if len(matches)!=1: raise ValueError('Missing main application Info.plist')
 info=matches[0]
 if info.file_size>2097152 or info.flag_bits&1: raise ValueError('Invalid Info.plist')
 with z.open(info) as member:
  raw=member.read(2097153)
  if len(raw)>2097152: raise ValueError("Info.plist limit exceeded")
 p=plistlib.loads(raw)
 executable=p.get('CFBundleExecutable')
 prefix=info.filename[:-len('Info.plist')]
 if not isinstance(executable,str) or '/' in executable or prefix+executable not in z.namelist(): raise ValueError('Missing app executable')
 def field(key,limit,required=True):
  v=p.get(key,'')
  if not isinstance(v,(str,int,float)): raise ValueError('Invalid metadata')
  v=str(v).strip()
  if (required and not v) or len(v)>limit or any(ord(c)<32 for c in v): raise ValueError('Invalid metadata')
  return v
 print(json.dumps({'appName':field('CFBundleDisplayName',200,False) or field('CFBundleName',200,False) or field('CFBundleIdentifier',200),'bundleId':field('CFBundleIdentifier',255),'version':field('CFBundleShortVersionString',64),'build':field('CFBundleVersion',64),'minIos':field('MinimumOSVersion',32,False) or None},ensure_ascii=False))
`;
export async function saveAndInspectIpa(file: File) {
  if (!/\.ipa$/i.test(file.name)) throw new ApiError("请选择 .ipa 安装包", 42200, 422);
  if (file.size === 0 || file.size > IPA_MAX_BYTES) throw new ApiError("IPA 不能为空，且不能超过 200 MB", 41300, 413);
  const key = `${randomUUID()}.ipa`;
  const absolute = ipaStoragePath(key);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) throw new ApiError("文件不是有效的 IPA", 42200, 422);
  await mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  try {
    await writeFile(absolute, buffer, { flag: "wx", mode: 0o600 });
  } catch {
    await unlink(absolute).catch(() => undefined);
    throw new ApiError("安装包保存失败，请检查服务器存储空间", 50000, 500);
  }
  try {
    const result = await execFileAsync(process.env.IPA_PYTHON || "python3", ["-I", "-c", inspectScript, absolute], { timeout: 15000, maxBuffer: 16384 });
    const metadata = JSON.parse(result.stdout) as { appName: string; bundleId: string; version: string; build: string; minIos: string | null };
    return { ...metadata, storageKey: key, bytes: buffer.length,
      filename: file.name.replace(/[\/\x00-\x1f\x7f]/g, "_").slice(0, 250),
      sha256: createHash("sha256").update(buffer).digest("hex"), notes: "" };
  } catch {
    await unlink(absolute).catch(() => undefined);
    throw new ApiError("IPA 无效或缺少应用信息，请检查安装包", 42200, 422);
  }
}

export async function syncArticleIpas(tx: Prisma.TransactionClient, postId: string, actorId: string, inputs: ArticleIpaInput) {
  const ids = inputs.map(item => item.id);
  // Locking the post serializes concurrent changes to its selected version and history.
  await tx.$queryRaw`SELECT id FROM posts WHERE id = ${postId} FOR UPDATE`;
  if (ids.length) await tx.$queryRaw`SELECT id FROM article_ipa_releases WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`;
  const releases = await tx.articleIpaRelease.findMany({ where: { id: { in: ids }, deletedAt: null } });
  if (releases.length !== ids.length || releases.some(item =>
    item.postId !== postId && (item.postId !== null || item.uploadedBy !== actorId)
  )) throw new ApiError("安装包不可用，或已绑定其他文章，请刷新后重试", 40900, 409);
  await tx.articleIpaRelease.updateMany({ where: { postId, deletedAt: null, id: { notIn: ids } }, data: { deletedAt: new Date() } });
  for (const [sortOrder, input] of inputs.entries()) {
    await tx.articleIpaRelease.update({ where: { id: input.id }, data: { postId, version: input.version, notes: input.notes, sortOrder } });
  }
}
