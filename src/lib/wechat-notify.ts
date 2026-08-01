export type WechatNotifyVersion = "v2" | "v3";

type WechatV3MerchantIdentity = {
  appId: string;
  mchId: string;
};

export type WechatV3MerchantMismatch = "appid" | "mchid" | null;

export function findWechatV3MerchantMismatch(
  transaction: Record<string, unknown>,
  expected: WechatV3MerchantIdentity
): WechatV3MerchantMismatch {
  if (transaction.appid !== expected.appId) return "appid";
  if (transaction.mchid !== expected.mchId) return "mchid";
  return null;
}

export function wechatNotifySuccess(version: WechatNotifyVersion): Response {
  if (version === "v3") {
    return new Response(null, { status: 204 });
  }
  return wechatV2XmlResponse("SUCCESS");
}

export function wechatNotifyFailure(
  version: WechatNotifyVersion,
  message: string,
  status = 400
): Response {
  if (version === "v3") {
    return Response.json(
      { code: "FAIL", message },
      { status }
    );
  }
  return wechatV2XmlResponse("FAIL", message);
}

function wechatV2XmlResponse(returnCode: string, returnMsg = ""): Response {
  const xml = `<xml><return_code><![CDATA[${returnCode}]]></return_code><return_msg><![CDATA[${returnMsg}]]></return_msg></xml>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}
