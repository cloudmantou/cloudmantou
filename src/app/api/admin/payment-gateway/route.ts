import { requireAdmin, ApiError } from "@/lib/guards";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { decryptGatewaySecrets, encryptGatewaySecrets } from "@/lib/secret-crypto";
import { normalizeAlipayEnv } from "@/lib/payment-config";
import { z } from "zod";

const GATEWAY_IDS = ["alipay", "wechat", "stripe", "usdt", "epay", "vpay"] as const;

const gatewaySchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.string().optional(),
  env: z.enum(["production", "sandbox"]).optional(),
  appId: z.string().optional(),
  privateKey: z.string().optional(),
  publicKey: z.string().optional(),
  mchId: z.string().optional(),
  apiKey: z.string().optional(),
  apiV3Key: z.string().optional(),
  platformSerial: z.string().optional(),
  sellerId: z.string().optional(),
  publishableKey: z.string().optional(),
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  currency: z.string().optional(),
  network: z.string().optional(),
  walletAddress: z.string().optional(),
  rateSource: z.string().optional(),
  rateMarkup: z.string().optional(),
  orderTimeout: z.string().optional(),
  confirmations: z.string().optional(),
  pid: z.string().optional(),
  key: z.string().optional(),
  apiUrl: z.string().optional(),
});

const saveSchema = z.object({
  testMode: z.boolean().optional(),
  gateways: z.record(gatewaySchema).optional(),
});

function maskSecret(value?: string) {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}

function defaultGateways() {
  const base = Object.fromEntries(GATEWAY_IDS.map((id) => [id, { enabled: id === "alipay" || id === "wechat" }]));
  return base;
}

async function readGateways(): Promise<Record<string, Record<string, unknown>>> {
  const row = await prisma.siteSetting.findUnique({ where: { key: "paymentGateways" } });
  if (!row?.value) return defaultGateways();
  try {
    const parsed = JSON.parse(row.value) as Record<string, Record<string, unknown>>;
    return { ...defaultGateways(), ...decryptGatewaySecrets(parsed) };
  } catch {
    return defaultGateways();
  }
}

async function readGatewaysRaw(): Promise<Record<string, Record<string, unknown>>> {
  const row = await prisma.siteSetting.findUnique({ where: { key: "paymentGateways" } });
  if (!row?.value) return defaultGateways();
  try {
    return { ...defaultGateways(), ...JSON.parse(row.value) };
  } catch {
    return defaultGateways();
  }
}

export async function GET() {
  try {
    await requireAdmin();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

    const [todaySuccess, todayWaiting, monthRefunds, channelToday, recentPayments, testModeRow, gateways] =
      await Promise.all([
        prisma.payment.findMany({
          where: { status: "SUCCESS", createdAt: { gte: startOfDay } },
          select: { amount: true, channel: true },
        }),
        prisma.payment.count({ where: { status: "WAITING" } }),
        prisma.order.count({
          where: { status: "REFUNDED", updatedAt: { gte: startOfMonth } },
        }),
        prisma.payment.groupBy({
          by: ["channel"],
          where: { status: "SUCCESS", createdAt: { gte: startOfDay } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.payment.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            order: {
              select: { orderNo: true, title: true, status: true },
            },
          },
        }),
        prisma.siteSetting.findUnique({ where: { key: "paymentTestMode" } }),
        readGateways(),
      ]);

    const todayRevenue = todaySuccess.reduce((s, p) => s + Number(p.amount), 0);
    const todayOrders = todaySuccess.length;
    const successTotal = await prisma.payment.count({
      where: { createdAt: { gte: startOfDay }, status: { in: ["SUCCESS", "FAILED"] } },
    });
    const successRate =
      successTotal > 0 ? Math.round((todayOrders / successTotal) * 1000) / 10 : 100;

    const channelStats: Record<string, { amount: number; count: number }> = {};
    for (const row of channelToday) {
      channelStats[row.channel] = {
        amount: Number(row._sum.amount || 0),
        count: row._count,
      };
    }

    const siteUrlRow = await prisma.siteSetting.findUnique({ where: { key: "siteUrl" } });
    const siteUrl = (siteUrlRow?.value || process.env.NEXTAUTH_URL || "https://cloudmantou.dev").replace(/\/$/, "");

    const maskedGateways = Object.fromEntries(
      Object.entries(gateways).map(([id, cfg]) => {
        const c = cfg as Record<string, string | boolean>;
        const normalized = { ...c } as Record<string, string | boolean>;
        if (id === "alipay") {
          normalized.env = normalizeAlipayEnv(c.env);
        }

        return [
          id,
          {
            ...normalized,
            privateKey: c.privateKey ? maskSecret(String(c.privateKey)) : "",
            publicKey: c.publicKey ? maskSecret(String(c.publicKey)) : "",
            apiKey: c.apiKey ? maskSecret(String(c.apiKey)) : "",
            apiV3Key: c.apiV3Key ? maskSecret(String(c.apiV3Key)) : "",
            secretKey: c.secretKey ? maskSecret(String(c.secretKey)) : "",
            publishableKey: c.publishableKey ? maskSecret(String(c.publishableKey)) : "",
            webhookSecret: c.webhookSecret ? maskSecret(String(c.webhookSecret)) : "",
            key: c.key ? maskSecret(String(c.key)) : "",
            hasPrivateKey: !!c.privateKey,
            hasPublicKey: !!c.publicKey,
            hasApiKey: !!c.apiKey,
            hasApiV3Key: !!c.apiV3Key,
            hasSecretKey: !!c.secretKey,
          },
        ];
      })
    );

    return ok({
      stats: {
        todayRevenue,
        todayOrders,
        pending: todayWaiting,
        monthRefunds,
        successRate,
      },
      channelStats,
      testMode: testModeRow?.value === "true",
      gateways: maskedGateways,
      callbacks: {
        alipay: `${siteUrl}/api/payment/notify/alipay`,
        wechat: `${siteUrl}/api/payment/notify/wechat`,
        stripe: `${siteUrl}/api/payment/notify/stripe`,
      },
      webhooks: [
        { event: "支付成功", code: "payment.success", url: `${siteUrl}/api/payment/notify/alipay`, status: "ok" },
        { event: "支付失败", code: "payment.failed", url: `${siteUrl}/api/payment/notify/wechat`, status: "ok" },
        { event: "退款完成", code: "refund.completed", url: "— 未配置 —", status: "pending" },
        { event: "订单超时", code: "order.expired", url: "— 未配置 —", status: "pending" },
      ],
      recentTransactions: recentPayments.map((p) => ({
        id: p.id,
        orderNo: p.order.orderNo,
        title: p.order.title,
        channel: p.channel,
        amount: Number(p.amount),
        status: p.status,
        orderStatus: p.order.status,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Payment Gateway GET Error]", error);
    return fail("获取支付对接数据失败", 50000, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0].message, 42200, 422);
    }

    const existing = await readGatewaysRaw();
    const existingDecrypted = decryptGatewaySecrets(existing);

    if (typeof parsed.data.testMode === "boolean") {
      await prisma.siteSetting.upsert({
        where: { key: "paymentTestMode" },
        update: { value: String(parsed.data.testMode) },
        create: { key: "paymentTestMode", value: String(parsed.data.testMode) },
      });
    }

    if (parsed.data.gateways) {
      const merged = { ...existingDecrypted };
      for (const [id, patch] of Object.entries(parsed.data.gateways)) {
        const prev = (merged[id] || {}) as Record<string, unknown>;
        const next: Record<string, unknown> = { ...prev, ...patch };
        if (id === "alipay" && patch.env !== undefined) {
          next.env = normalizeAlipayEnv(patch.env);
        }
        for (const [k, v] of Object.entries(patch)) {
          if (typeof v === "string" && v.includes("••••")) {
            if (prev[k] !== undefined) {
              next[k] = prev[k];
            } else {
              delete next[k];
            }
          }
        }
        merged[id] = next;
      }
      const encrypted = encryptGatewaySecrets(merged);
      await prisma.siteSetting.upsert({
        where: { key: "paymentGateways" },
        update: { value: JSON.stringify(encrypted) },
        create: { key: "paymentGateways", value: JSON.stringify(encrypted) },
      });
    }

    return ok({ saved: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    console.error("[Payment Gateway PUT Error]", error);
    return fail("保存支付配置失败", 50000, 500);
  }
}