import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("payment checkout flow", () => {
  it("lets the server select PC or H5 mode and removes manual scene overrides", () => {
    const checkout = source("src/components/payment/PaymentCheckout.tsx");
    expect(checkout).toMatch(/scene:\s*["']auto["']/);
    expect(checkout).not.toContain('onClick={() => setScene("pc")}');
    expect(checkout).not.toContain('onClick={() => setScene("h5")}');
    expect(checkout).not.toContain('onClick={() => setScene("wechat_inapp")}');
  });

  it("keeps a paid receipt open instead of navigating to dashboard or admin", () => {
    const checkout = source("src/components/payment/PaymentCheckout.tsx");
    const result = source("src/app/payment/result/page.tsx");
    const middleware = source("src/middleware.ts");

    expect(checkout).toContain("setReceipt");
    expect(checkout).toContain("paidNotificationPendingRef");
    expect(checkout).not.toMatch(/setReceipt\(nextReceipt\);\s*onPaidRef\.current/);
    expect(checkout).not.toContain("router.push(paidReturnPath)");
    expect(checkout).toContain("fulfillment.card.cardSecret");
    expect(result).toContain("fulfillment.card.cardSecret");
    expect(result).not.toContain("router.replace(dashboardOrdersUrl)");
    expect(middleware).not.toMatch(/pathname\.startsWith\(["']\/dashboard["']\)[\s\S]{0,700}redirect\(new URL\(["']\/admin["']/);
  });
});
