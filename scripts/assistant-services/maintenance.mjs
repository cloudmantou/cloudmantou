// Run by the dedicated systemd timer with the production env file. Never print
// credentials, local device URLs or manifest contents.
import { readdir, lstat, unlink } from "node:fs/promises";
import path from "node:path";

if (!process.env.CRON_SECRET) throw new Error("Missing maintenance credential");
const response = await fetch("http://127.0.0.1:3100/api/cron/assistant-services", {
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  signal: AbortSignal.timeout(15000), redirect: "error",
});
if (!response.ok) throw new Error(`Assistant maintenance returned HTTP ${response.status}`);
const legacy = "/www/wwwroot/install.cloudmantoua.top/ipa/sign/public/backend/manifests";
let removed = 0;
for (const entry of await readdir(legacy, { withFileTypes: true })) {
  if (!entry.isFile() || !/^[a-fA-F0-9-]{32,36}\.plist$/.test(entry.name)) continue;
  const file = path.join(legacy, entry.name);
  const stat = await lstat(file).catch(() => null);
  if (stat?.isFile() && stat.mtimeMs < Date.now() - 86400000) {
    await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; });
    removed++;
  }
}
console.log(JSON.stringify({ sampled: true, expiredLegacyManifestsRemoved: removed }));
