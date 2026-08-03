import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("editorial account and auth entry points", () => {
  it("keeps callback URLs across login, registration, and successful sign-in", () => {
    const login = source("src/app/(auth)/login/page.tsx");
    const register = source("src/app/(auth)/register/page.tsx");

    expect(login).toContain("normalizeInternalReturnUrl");
    expect(login).toMatch(/callbackUrl=.*encodeURIComponent/);
    expect(register).toContain("normalizeInternalReturnUrl");
    expect(register).toMatch(/router\.push\(callbackUrl\)/);
  });

  it("uses the editorial shell and localized account copy instead of legacy marketing chrome", () => {
    const authLayout = source("src/app/(auth)/layout.tsx");
    const dashboard = source("src/app/dashboard/page.tsx");
    const account = source("src/components/dashboard/UserDashboard.tsx");

    expect(authLayout).toContain("EditorialShell");
    expect(dashboard).toContain("EditorialShell");
    expect(dashboard).not.toContain("MarketingShell");
    expect(account).toContain("useOfficialI18n");
    expect(account).toContain("Intl.NumberFormat");
    expect(account).toContain('localizeOfficialPath("/pricing", locale)');
    expect(account).toContain("PaymentCheckout");
    expect(account).toContain("continuePayment");
  });
});
