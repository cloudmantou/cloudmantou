export type PaymentScene = "pc" | "h5" | "wechat_inapp";

export type AlipayPayMode = "page" | "wap";
export type WechatPayMode = "native" | "mweb";

export function detectPaymentScene(userAgent: string): PaymentScene {
  const ua = userAgent.toLowerCase();
  if (/micromessenger/.test(ua)) return "wechat_inapp";
  if (/mobile|android|iphone|ipod|ipad|webos|blackberry|iemobile|opera mini/i.test(ua)) {
    return "h5";
  }
  return "pc";
}

export function resolveAlipayMode(scene: PaymentScene): AlipayPayMode {
  return scene === "pc" ? "page" : "wap";
}

/** 微信内浏览器需 JSAPI（openid），当前未实现则返回 null */
export function resolveWechatMode(scene: PaymentScene): WechatPayMode | null {
  if (scene === "wechat_inapp") return null;
  return scene === "pc" ? "native" : "mweb";
}

export function sceneLabel(scene: PaymentScene): string {
  switch (scene) {
    case "pc":
      return "电脑端";
    case "h5":
      return "手机浏览器";
    case "wechat_inapp":
      return "微信内";
    default:
      return "当前设备";
  }
}