import type { RegionStatus } from "@/lib/assistant-services";
export function recoveryAdvice(region: RegionStatus): string {
  if (!region.reachable || !region.data) return "服务状态接口不可达，需检查进程或发布环境；此时不能发起认证恢复。";
  const { auth, recovery, requests } = region.data;
  if (recovery?.running) return "重新认证正在执行，请等待结果，勿重复操作。";
  if (auth.locked) return auth.lockCode === "auth_code_required" ? "账号需要验证码，需管理员完成安全登录；不会自动清除认证锁。" : "账号凭证或状态需要管理员处理，恢复按钮不会绕过账号锁。";
  if (auth.cooldownUntil && new Date(auth.cooldownUntil).getTime() > Date.now()) return "认证处于冷却期，请等待结束。冷却结束后可以受控重试一次。";
  const recent = requests?.recent.at(-1);
  const kind = recovery?.result && recovery.result !== "ok" ? recovery.diagnostic.kind : recent?.diagnostic.kind;
  if (kind === "anisette_assets") return "认证运行资源缺失或获取失败，需要校验并修复服务器资源；反复重新登录不能替代资源修复。";
  if (kind === "version_mismatch") return "Apple 返回的版本与请求不同，请检查该历史版本是否仍可下载。";
  if (kind === "package_size_limit") return "安装包超过配置的大小上限，请检查包体大小与服务容量。";
  if (recent?.result === "purchase_unavailable") return "此应用授权取得失败，请检查账号地区和应用是否可领取。";
  if (recent?.result === "download_unavailable") return "失败发生在下载准备阶段；先核对该版本及诊断信息，重新认证不一定有效。";
  return "当前未发现认证锁或冷却。若下载仍提示认证错误，可受控重新认证一次；完成后重新尝试原下载。";
}
