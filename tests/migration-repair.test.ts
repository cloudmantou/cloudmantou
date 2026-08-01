import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../prisma/migrations/20260719010000_repair_schema_drift/migration.sql",
  import.meta.url
);

describe("schema drift repair migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("adds the card delivery fields and GENERIC card type without replacing prior migrations", () => {
    expect(sql).toMatch(/ALTER TABLE `cards`[\s\S]*`cardSecretEnc` TEXT NULL/);
    expect(sql).toMatch(/ENUM\('VIP_DAYS', 'PAID_ARTICLE', 'BALANCE', 'GENERIC'\)/);
    expect(sql).toContain("`packageId` VARCHAR(191) NULL");
    expect(sql).toContain("`orderId` VARCHAR(191) NULL");
    expect(sql).toContain("`note` VARCHAR(500) NULL");
  });

  it("creates order delivery and vault tables with their foreign keys", () => {
    expect(sql).toContain("CREATE TABLE `order_deliveries`");
    expect(sql).toContain("CREATE TABLE `vault_entries`");
    expect(sql).toContain("order_deliveries_orderId_fkey");
    expect(sql).toContain("order_deliveries_cardId_fkey");
  });

  it("adds card package redemption copy and widens Store install URLs", () => {
    expect(sql).toContain("ADD COLUMN `redemptionNote` VARCHAR(500) NULL");
    expect(sql).toMatch(
      /ALTER TABLE `card_packages`[\s\S]*ENUM\('VIP_DAYS', 'PAID_ARTICLE', 'BALANCE', 'GENERIC'\)/
    );
    expect(sql).toMatch(/ALTER TABLE `store_apps` MODIFY `installUrl` TEXT NULL/);
  });

  it("restores the indexes and package relationship declared by Prisma", () => {
    expect(sql).toContain("cards_orderId_key");
    expect(sql).toContain("cards_type_value_status_idx");
    expect(sql).toContain("cards_packageId_status_idx");
    expect(sql).toContain("cards_packageId_fkey");
  });
});
