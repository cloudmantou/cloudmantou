import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { expect, it } from "vitest";
it.each([0, 1])("reports failed delivery batches to the scheduler (failed=%s)", async failed => {
  let authorization: string | undefined, url: string | undefined;
  const server = createServer((req, res) => { authorization = req.headers.authorization; url = req.url; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ code: 0, data: { expired: 0, cardDeliveries: { scanned: 1, delivered: failed ? 0 : 1, failed }, licenseBindings: { removed: 0 } } })); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address();
  try {
    const child = spawn(process.execPath, ["scripts/run-maintenance.mjs"], { env: { ...process.env, CRON_SECRET: "private-test-secret", MAINTENANCE_PORT: String(typeof address === "object" ? address?.port : 0) } });
    let output = ""; child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { output += chunk; });
    const code = await new Promise(resolve => child.on("close", resolve)); expect(code).toBe(failed ? 1 : 0); expect(authorization).toBe("Bearer private-test-secret"); expect(url).toBe("/api/cron/expire-orders"); expect(output).not.toContain("private-test-secret");
  } finally { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
});
