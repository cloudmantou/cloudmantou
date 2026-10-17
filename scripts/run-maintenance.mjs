// Run locally: node --env-file=.env scripts/run-maintenance.mjs
// Keep CRON_SECRET in the existing private environment file, never in arguments.
const secret = process.env.CRON_SECRET?.trim();
const port = Number(process.env.MAINTENANCE_PORT || 3100);
if (!secret || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Maintenance environment is not configured");
  process.exit(1);
}
try {
  const response = await fetch(`http://127.0.0.1:${port}/api/cron/expire-orders`, {
    headers: { Authorization: `Bearer ${secret}` },
    redirect: "error",
    signal: AbortSignal.timeout(55000),
  });
  if (!response.ok) throw new Error("Maintenance request failed");
  const result = await response.json();
  if (result.code !== 0 || result.data?.licenseBindings?.error) throw new Error("Maintenance reported a failure");
  const { expired, cardDeliveries, licenseBindings } = result.data;
  console.log(JSON.stringify({ expired, cardDeliveries, licenseBindings }));
} catch {
  console.error("Maintenance failed; check the blog service log");
  process.exitCode = 1;
}
