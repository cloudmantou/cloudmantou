import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/guards";

import { licenseDb, generateLicenseKey } from "@/lib/legacy-license-db";
export { licenseDb } from "@/lib/legacy-license-db";

const id = z.number().int().positive();
export const MAX_BATCH_UNBIND = 100;
export const MAX_BINDING_TTL_DAYS = 3650;
export const DEFAULT_BINDING_TTL_DAYS = 30;
const BINDING_TTL_KEY = "appLicenses.bindingTtlDays";
const BINDING_BASELINE_KEY = "appLicenses.bindingExpiryAfterId";
const text = z.string().trim().min(1).max(255);
const link = z.string().trim().max(255).refine(v => !v || /^https?:\/\//i.test(v), "请输入 http 或 https 地址");
export const licenseMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("app.save"), id: text, name: text, version: z.string().trim().max(255), identifier: z.string().trim().max(255), plist: link, pkg: link, requiresKey: z.boolean() }).strict(),
  z.object({ action: z.literal("app.require-key"), id: text, requiresKey: z.boolean() }).strict(),
  z.object({ action: z.literal("app.delete"), id: text }).strict(),
  z.object({ action: z.literal("app.sync") }).strict(),
  z.object({ action: z.literal("card.generate"), count: z.number().int().min(1).max(500) }).strict(),
  z.object({ action: z.literal("card.import"), cards: z.array(text).min(1).max(500) }).strict(),
  z.object({ action: z.literal("card.delete"), id }).strict(),
  z.object({ action: z.literal("card.reset"), id }).strict(),
  z.object({ action: z.literal("binding.add"), udid: text, cardKey: text }).strict(),
  z.object({ action: z.literal("binding.delete"), id }).strict(),
  z.object({ action: z.literal("binding.delete-batch"), ids: z.array(id).min(1).max(MAX_BATCH_UNBIND) }).strict(),
  z.object({ action: z.literal("binding.ttl"), days: z.number().int().min(0).max(MAX_BINDING_TTL_DAYS) }).strict(),
]);
export type LicenseMutation = z.infer<typeof licenseMutationSchema>;

export function licensePageParams(params: URLSearchParams) {
  const parsed = z.object({
    tab: z.enum(["apps", "cards", "bindings"]).default("apps"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    search: z.string().trim().max(255).default(""),
    status: z.enum(["all", "unused", "used"]).default("all"),
  }).safeParse(Object.fromEntries(params));
  if (!parsed.success) throw new ApiError("查询参数无效", 42200, 422);
  return parsed.data;
}

type Row = Record<string, unknown>;
export function licenseJson(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(licenseJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, licenseJson(v)]));
  return value;
}

export async function listLicenses(params: ReturnType<typeof licensePageParams>, db = licenseDb(), ttlDays?: number, afterId?: number | null) {
  const { tab, page, search, status } = params;
  const bindingTtlDays = ttlDays ?? await getBindingTtlDays();
  const bindingExpiryAfterId = afterId !== undefined ? afterId : await getBindingExpiryAfterId();
  const pageSize = 30;
  const needle = `%${search}%`;
  const offset = (page - 1) * pageSize;
  const [stats] = await db.$queryRaw<Row[]>`SELECT
    (SELECT COUNT(*) FROM apps) apps,
    (SELECT COUNT(*) FROM cards) cards,
    (SELECT COUNT(*) FROM cards WHERE used = 0) available,
    (SELECT COUNT(*) FROM bindings) bindings`;
  let rows: Row[], totals: { n: bigint }[];
  if (tab === "apps") {
    const where = Prisma.sql`WHERE name LIKE ${needle} OR id LIKE ${needle} OR identifier LIKE ${needle}`;
    [rows, totals] = await Promise.all([
      db.$queryRaw<Row[]>(Prisma.sql`SELECT id, name, version, identifier, plist, pkg, requires_key, updated_at FROM apps ${where} ORDER BY updated_at DESC, id LIMIT ${pageSize} OFFSET ${offset}`),
      db.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT COUNT(*) n FROM apps ${where}`),
    ]);
  } else if (tab === "cards") {
    const state = status === "all" ? Prisma.empty : Prisma.sql`AND c.used = ${status === "used" ? 1 : 0}`;
    const where = Prisma.sql`WHERE (c.card_key LIKE ${needle} OR EXISTS (SELECT 1 FROM bindings b WHERE b.card_id=c.id AND b.udid LIKE ${needle})) ${state}`;
    [rows, totals] = await Promise.all([
      db.$queryRaw<Row[]>(Prisma.sql`SELECT c.id,c.card_key,c.used,c.created_at,c.used_at,(SELECT COUNT(*) FROM bindings b WHERE b.card_id=c.id) binding_count FROM cards c ${where} ORDER BY c.id DESC LIMIT ${pageSize} OFFSET ${offset}`),
      db.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT COUNT(*) n FROM cards c ${where}`),
    ]);
  } else {
    const where = Prisma.sql`WHERE b.udid LIKE ${needle} OR c.card_key LIKE ${needle}`;
    [rows, totals] = await Promise.all([
      // Remaining time is computed by MySQL against its own NOW(), the same clock the
      // expiry job uses, so legacy DATETIME time zones cannot skew the countdown.
      db.$queryRaw<Row[]>(Prisma.sql`SELECT b.id,b.udid,b.card_id,b.created_at,c.card_key,${bindingTtlDays > 0 && bindingExpiryAfterId !== null ? Prisma.sql`CASE WHEN b.id > ${bindingExpiryAfterId} THEN TIMESTAMPDIFF(SECOND,NOW(),b.created_at + INTERVAL ${bindingTtlDays} DAY) ELSE NULL END` : Prisma.sql`NULL`} expires_in FROM bindings b JOIN cards c ON c.id=b.card_id ${where} ORDER BY b.id DESC LIMIT ${pageSize} OFFSET ${offset}`),
      db.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT COUNT(*) n FROM bindings b JOIN cards c ON c.id=b.card_id ${where}`),
    ]);
  }
  return licenseJson({ stats, rows, page, pageSize, total: Number(totals[0].n), bindingTtlDays, bindingExpiryAfterId });
}

function conflict(message: string): never { throw new ApiError(message, 40900, 409); }
function notFound() { throw new ApiError("记录不存在，请刷新后重试", 40400, 404); }

export async function mutateLicense(input: LicenseMutation, db = licenseDb()): Promise<{ message: string; cards?: string[] }> {
  switch (input.action) {
    case "app.save": {
      await db.$executeRaw`INSERT INTO apps (id,name,version,identifier,plist,pkg,requires_key)
        VALUES (${input.id},${input.name},${input.version},${input.identifier},${input.plist},${input.pkg},${input.requiresKey})
        ON DUPLICATE KEY UPDATE name=VALUES(name),version=VALUES(version),identifier=VALUES(identifier),plist=VALUES(plist),pkg=VALUES(pkg),requires_key=VALUES(requires_key)`;
      return { message: "应用已保存" };
    }
    case "app.require-key": {
      const found = await db.$queryRaw<Row[]>`SELECT id FROM apps WHERE id=${input.id}`;
      if (!found.length) notFound();
      await db.$executeRaw`UPDATE apps SET requires_key=${input.requiresKey} WHERE id=${input.id}`;
      return { message: input.requiresKey ? "已开启卡密验证" : "已关闭卡密验证" };
    }
    case "app.delete": {
      if (!await db.$executeRaw`DELETE FROM apps WHERE id=${input.id}`) notFound();
      return { message: "应用已删除，历史卡密和设备绑定已保留" };
    }
    case "app.sync": return syncLicenseApps(db);
    case "card.generate":
    case "card.import": {
      const keys = input.action === "card.generate"
        ? Array.from({ length: input.count }, generateLicenseKey)
        : [...new Set(input.cards)];
      return db.$transaction(async tx => {
        const cards: string[] = [];
        for (const key of keys) {
          const inserted = await tx.$executeRaw`INSERT IGNORE INTO cards (card_key,used) VALUES (${key},0)`;
          if (inserted) cards.push(key);
        }
        return { message: `新增 ${cards.length} 张，跳过 ${keys.length - cards.length} 张已有卡密`, cards };
      }, { timeout: 30000 });
    }
    case "card.delete": return db.$transaction(async tx => {
      const cards = await tx.$queryRaw<Row[]>`SELECT id FROM cards WHERE id=${input.id} FOR UPDATE`;
      if (!cards.length) notFound();
      await tx.$executeRaw`DELETE FROM bindings WHERE card_id=${input.id}`;
      await tx.$executeRaw`DELETE FROM cards WHERE id=${input.id}`;
      return { message: "卡密及关联设备授权已删除" };
    });
    case "card.reset": return db.$transaction(async tx => {
      const cards = await tx.$queryRaw<Row[]>`SELECT id FROM cards WHERE id=${input.id} FOR UPDATE`;
      if (!cards.length) notFound();
      const bindings = await tx.$queryRaw<Row[]>`SELECT id FROM bindings WHERE card_id=${input.id} FOR UPDATE`;
      if (bindings.length) conflict("请先解除该卡密的全部设备绑定，再重置卡密");
      await tx.$executeRaw`UPDATE cards SET used=0,used_at=NULL WHERE id=${input.id}`;
      return { message: "卡密已恢复为未使用" };
    });
    case "binding.add": return db.$transaction(async tx => {
      // Lock the card before checking used state, so concurrent claims cannot
      // bind one unused key to two devices through the new management endpoint.
      const cards = await tx.$queryRaw<{ id: number; used: number }[]>`SELECT id,used FROM cards WHERE card_key=${input.cardKey} FOR UPDATE`;
      if (!cards.length || cards[0].used) conflict("卡密不存在或已使用");
      const existing = await tx.$queryRaw<Row[]>`SELECT id FROM bindings WHERE udid=${input.udid} FOR UPDATE`;
      if (existing.length) conflict("此设备已有授权，请先解除原绑定");
      await tx.$executeRaw`INSERT INTO bindings (udid,card_id) VALUES (${input.udid},${cards[0].id})`;
      await tx.$executeRaw`UPDATE cards SET used=1,used_at=NOW() WHERE id=${cards[0].id}`;
      return { message: "设备已绑定，卡密已标记使用" };
    });
    case "binding.delete": {
      if (!await deleteBindings(db, [input.id])) notFound();
      return { message: "设备授权已解除；卡密保持已使用，避免被意外重复发放" };
    }
    case "binding.delete-batch": {
      const ids = [...new Set(input.ids)];
      const removed = await db.$transaction(tx => deleteBindings(tx, ids));
      const skipped = ids.length - removed;
      return { message: `已解除 ${removed} 台设备授权${skipped ? `，${skipped} 条记录已不存在` : ""}；卡密保持已使用` };
    }
    case "binding.ttl": {
      await setBindingTtlDays(input.days, undefined, db);
      return { message: input.days ? `绑定满 ${input.days} 天后将自动解除` : "已关闭到期自动解除" };
    }
  }
}

type RawExecutor = Pick<PrismaClient, "$executeRaw">;
// Shared by single, batch and scheduled unbinding: only the grant is removed and
// the card stays used, so an expired or revoked key can never be handed out again.
function deleteBindings(db: RawExecutor, ids: number[], olderThanDays?: number, afterId?: number) {
  const expired = olderThanDays ? Prisma.sql`AND created_at < NOW() - INTERVAL ${olderThanDays} DAY` : Prisma.empty;
  const eligible = afterId !== undefined ? Prisma.sql`AND id > ${afterId}` : Prisma.empty;
  return db.$executeRaw`DELETE FROM bindings WHERE id IN (${Prisma.join(ids)}) ${expired} ${eligible}`;
}

type SettingStore = {
  siteSetting: {
    findUnique(args: { where: { key: string } }): Promise<{ value: string } | null>;
    upsert(args: { where: { key: string }; update: { value?: string }; create: { key: string; value: string; type: string } }): Promise<unknown>;
  };
};
async function settings(store?: SettingStore): Promise<SettingStore> {
  return store ?? (await import("@/lib/prisma")).prisma;
}

export async function getBindingTtlDays(store?: SettingStore) {
  const row = await (await settings(store)).siteSetting.findUnique({ where: { key: BINDING_TTL_KEY } });
  const days = Number(row?.value);
  return row && Number.isInteger(days) && days >= 0 && days <= MAX_BINDING_TTL_DAYS ? days : DEFAULT_BINDING_TTL_DAYS;
}

export async function getBindingExpiryAfterId(store?: SettingStore) {
  const row = await (await settings(store)).siteSetting.findUnique({ where: { key: BINDING_BASELINE_KEY } });
  if (!row || !/^\d+$/.test(row.value)) return null;
  const id = Number(row.value);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

export async function setBindingTtlDays(days: number, store?: SettingStore, db?: PrismaClient) {
  if (!Number.isInteger(days) || days < 0 || days > MAX_BINDING_TTL_DAYS) throw new ApiError("自动解除天数无效", 42200, 422);
  const target = await settings(store);
  if (days > 0 && await getBindingExpiryAfterId(target) === null) {
    // Freeze an immutable AUTO_INCREMENT high-water mark. Existing grants stay
    // permanent even if their dates are old, the TTL changes, or clocks differ.
    const [row] = await (db ?? licenseDb()).$queryRaw<{ maxId: number | bigint }[]>`SELECT COALESCE(MAX(id),0) maxId FROM bindings`;
    await target.siteSetting.upsert({ where: { key: BINDING_BASELINE_KEY }, update: {}, create: { key: BINDING_BASELINE_KEY, value: String(row.maxId), type: "number" } });
    if (await getBindingExpiryAfterId(target) === null) throw new ApiError("历史授权保护设置异常，未启用自动解除", 50300, 503);
  }
  const value = String(days);
  await target.siteSetting.upsert({ where: { key: BINDING_TTL_KEY }, update: { value }, create: { key: BINDING_TTL_KEY, value, type: "number" } });
}

export type BindingExpiryResult = { ttlDays: number; removed: number; batches: number; more: boolean; skipped?: string };
// Removes grants older than the configured period in bounded batches so one
// cron tick never holds long locks on the table the legacy clients verify against.
export async function expireLicenseBindings(options: { db?: PrismaClient; ttlDays?: number; afterId?: number | null; batchSize?: number; maxBatches?: number } = {}): Promise<BindingExpiryResult> {
  const ttlDays = options.ttlDays ?? await getBindingTtlDays();
  const { batchSize = 200, maxBatches = 10 } = options;
  const result = { ttlDays, removed: 0, batches: 0, more: false };
  if (!ttlDays) return result;
  const afterId = options.afterId !== undefined ? options.afterId : await getBindingExpiryAfterId();
  if (afterId === null) return { ...result, skipped: "尚未初始化历史授权保护，请在后台启用新绑定到期规则" };
  const db = options.db ?? licenseDb();
  while (result.batches < maxBatches) {
    const due = await db.$queryRaw<{ id: number | bigint }[]>`SELECT id FROM bindings WHERE id > ${afterId} AND created_at < NOW() - INTERVAL ${ttlDays} DAY ORDER BY id LIMIT ${batchSize}`;
    if (!due.length) return result;
    result.batches++;
    // The age condition is re-checked on delete, so a device re-bound between the
    // SELECT and DELETE under a recycled row id is not removed early.
    result.removed += await deleteBindings(db, due.map(row => Number(row.id)), ttlDays, afterId);
    if (due.length < batchSize) return result;
  }
  result.more = true;
  return result;
}

const syncItem = z.object({ id: text, name: text, date: z.string().max(255).nullish(), size: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullish(), channel: z.string().max(255).nullish(), build: z.string().max(255).nullish(), version: z.string().max(255).nullish(), identifier: z.string().max(255).nullish(), pkg: link.nullish(), icon: link.nullish(), plist: link.nullish(), webIcon: link.nullish(), type: z.coerce.number().int().nullish() });
export function parseLicenseApps(data: unknown) {
  const list = Array.isArray(data) ? data : data && typeof data === "object" && "list" in data ? data.list : null;
  if (!Array.isArray(list) || list.length > 2000) throw new ApiError("应用源数据格式不正确", 50200, 502);
  return list.map(item => {
    const records = Array.isArray(item?.history) ? item.history : [];
    const current = item?.current ? item : records.find((r: { current?: boolean }) => r?.current) || records[0] || item;
    return syncItem.parse(current);
  });
}

async function syncLicenseApps(db: PrismaClient) {
  const url = process.env.LEGACY_APP_SOURCE_URL;
  if (!url) throw new ApiError("应用同步源尚未配置", 50300, 503);
  // The upstream is deployment configuration, never an arbitrary browser URL.
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: "error", cache: "no-store" });
  if (!response.ok) throw new ApiError("应用源暂时不可用", 50200, 502);
  const { readRequestBodyWithLimit } = await import("@/lib/request-body");
  const apps = parseLicenseApps(JSON.parse(await readRequestBodyWithLimit(response, 4 * 1024 * 1024)));
  await db.$transaction(async tx => {
    for (const a of apps) {
      await tx.$executeRaw`INSERT INTO apps (id,name,date,size,channel,build,version,identifier,pkg,icon,plist,web_icon,type,requires_key)
        VALUES (${a.id},${a.name},${a.date ?? null},${a.size ?? null},${a.channel ?? ""},${a.build ?? null},${a.version ?? null},${a.identifier ?? null},${a.pkg ?? null},${a.icon ?? null},${a.plist ?? null},${a.webIcon ?? null},${a.type ?? 0},1)
        ON DUPLICATE KEY UPDATE name=VALUES(name),date=VALUES(date),size=VALUES(size),channel=VALUES(channel),build=VALUES(build),version=VALUES(version),identifier=VALUES(identifier),pkg=VALUES(pkg),icon=VALUES(icon),plist=VALUES(plist),web_icon=VALUES(web_icon),type=VALUES(type)`;
    }
  }, { timeout: 30000 });
  return { message: `已同步 ${apps.length} 个应用，原有卡密开关保持不变` };
}
